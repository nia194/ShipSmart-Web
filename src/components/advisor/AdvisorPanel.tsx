/**
 * Shipment-scoped advisor panel.
 *
 * A small, non-disruptive entry point ("Ask about this shipment") that expands
 * inline next to the quote/shipment surface. Supports a simple multi-turn thread
 * (kept in React state — NO localStorage/sessionStorage), surfaces the backend's
 * decision-path/source tags and grounding citations, and degrades gracefully on
 * the LLM error taxonomy. An advisor error never affects the quote/booking flow.
 */
import type { FormEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  ADVISOR_MAX_QUESTION_LENGTH,
  type AdvisorContext,
  type AdvisorSource,
  type DecisionPath,
  fetchShipment,
  friendlyAdvisorError,
  postShippingAdvice,
  postTrackingAdvice,
  shipmentToContext,
} from "@/lib/advisor-api";

type Mode = "shipping" | "tracking";

interface Turn {
  id: string;
  mode: Mode;
  question: string;
  answer: string;
  sources: AdvisorSource[];
  decisionPath: DecisionPath | null;
  nextSteps: string[];
}

interface AdvisorPanelProps {
  /** Shipment facts forwarded to the advisor (origin/destination/weight/dates). */
  context: AdvisorContext;
  /** If set, context is hydrated read-only from Java instead of relying solely
   *  on `context` — so the user needn't re-type a persisted shipment. */
  shipmentId?: string;
  /** Entry-point / heading label. */
  label?: string;
}

const PROVENANCE: Record<string, { label: string; bg: string; fg: string }> = {
  llm: { label: "AI-generated", bg: "#f3e8ff", fg: "#7e22ce" },
  rule: { label: "Rule-based", bg: "#e0f2fe", fg: "#0369a1" },
  fallback: { label: "Fallback", bg: "#fef3c7", fg: "#b45309" },
};

function DecisionBadge({ decisionPath }: { decisionPath: DecisionPath | null }) {
  if (!decisionPath) return null;
  const p = PROVENANCE[decisionPath.answer] ?? PROVENANCE.fallback;
  const detail =
    `path: ${decisionPath.answer} · provider: ${decisionPath.provider || "n/a"}` +
    (decisionPath.tags?.length ? ` · ${decisionPath.tags.join(", ")}` : "");
  return (
    <span
      title={detail}
      style={{
        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
        background: p.bg, color: p.fg, letterSpacing: 0.2,
      }}
    >
      {p.label}
    </span>
  );
}

function CitationChips({ sources }: { sources: AdvisorSource[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }} aria-label="Sources">
      {sources.slice(0, 5).map((s, i) => (
        <span
          key={`${s.source}-${s.chunk_index}-${i}`}
          title={`Grounded in ${s.source} (relevance ${s.score.toFixed(3)})`}
          style={{
            fontSize: 10, color: "#475569", background: "#f1f5f9",
            border: "1px solid #e2e8f0", borderRadius: 6, padding: "2px 7px",
          }}
        >
          {"📄"} {s.source} · {s.score.toFixed(2)}
        </span>
      ))}
    </div>
  );
}

export default function AdvisorPanel({
  context,
  shipmentId,
  label = "Ask about this shipment",
}: AdvisorPanelProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("shipping");
  const [thread, setThread] = useState<Turn[]>([]);
  const [input, setInput] = useState("");

  // Optional, read-only context hydration from Java — only when an id is given.
  const shipmentQuery = useQuery({
    queryKey: ["advisor-shipment", shipmentId],
    queryFn: () => fetchShipment(shipmentId as string),
    enabled: open && !!shipmentId,
    staleTime: 5 * 60 * 1000,
  });

  const effectiveContext: AdvisorContext = useMemo(
    () => (shipmentQuery.data ? { ...context, ...shipmentToContext(shipmentQuery.data) } : context),
    [context, shipmentQuery.data],
  );

  const turnSeq = useRef(0);

  const ask = useMutation<Turn, unknown, string>({
    mutationFn: async (question) => {
      if (mode === "shipping") {
        const r = await postShippingAdvice(question, effectiveContext);
        return {
          id: String(turnSeq.current++), mode, question, answer: r.answer,
          sources: r.sources ?? [], decisionPath: r.decision_path ?? null, nextSteps: [],
        };
      }
      const r = await postTrackingAdvice(question, effectiveContext);
      return {
        id: String(turnSeq.current++), mode, question, answer: r.guidance,
        sources: r.sources ?? [], decisionPath: r.decision_path ?? null,
        nextSteps: r.next_steps ?? [],
      };
    },
    onSuccess: (turn) => {
      setThread((prev) => [...prev, turn]);
      setInput("");
    },
  });

  const trimmed = input.trim();
  const overLimit = input.length > ADVISOR_MAX_QUESTION_LENGTH;
  const canSend = trimmed.length >= 3 && !overLimit && !ask.isPending;

  const submit = () => {
    if (!canSend) return;
    ask.mutate(trimmed);
  };
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  if (!open) {
    return (
      <button
        type="button"
        className="ss-btn ss-btn-outline ss-btn-sm"
        style={{ marginTop: 12 }}
        onClick={() => setOpen(true)}
      >
        {"💬"} {label}
      </button>
    );
  }

  const friendly = ask.isError ? friendlyAdvisorError(ask.error) : null;
  const ctx = effectiveContext;

  return (
    <section className="ss-card" aria-label="Shipment advisor" style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #eef0f2" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{"💬"} {label}</span>
        <button type="button" aria-label="Close advisor" className="ss-btn ss-btn-outline ss-btn-sm" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      <div role="tablist" aria-label="Advisor mode" style={{ display: "flex", gap: 6, padding: "10px 16px 0" }}>
        {(["shipping", "tracking"] as const).map((m) => (
          <button
            key={m} type="button" role="tab" aria-selected={mode === m}
            onClick={() => setMode(m)}
            style={{
              fontSize: 12, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
              border: mode === m ? "1px solid #2563EB" : "1px solid #e5e7eb",
              background: mode === m ? "#2563EB" : "transparent",
              color: mode === m ? "#fff" : "#6b7280", fontWeight: mode === m ? 600 : 500,
            }}
          >
            {m === "shipping" ? "Shipping advice" : "Delivery & tracking"}
          </button>
        ))}
      </div>

      {(ctx.origin_zip || ctx.destination_zip) && (
        <div style={{ padding: "6px 16px 0", fontSize: 11, color: "#9ca3af" }}>
          Context: {ctx.origin_zip ?? "?"} {"→"} {ctx.destination_zip ?? "?"}
          {ctx.weight_lbs ? ` · ${ctx.weight_lbs} lbs` : ""}
          {shipmentQuery.data ? " · from saved shipment" : ""}
        </div>
      )}

      <div style={{ padding: "12px 16px", maxHeight: 360, overflowY: "auto" }}>
        {thread.length === 0 && !ask.isPending && (
          <p style={{ fontSize: 13, color: "#9ca3af", margin: "4px 0" }}>
            Ask anything about this shipment — carriers, packaging, delays, or which option fits.
          </p>
        )}

        {thread.map((t) => (
          <div key={t.id} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 6 }}>{t.question}</div>
            <div style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{t.answer}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <DecisionBadge decisionPath={t.decisionPath} />
            </div>
            {t.nextSteps.length > 0 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, color: "#4b5563" }}>
                {t.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
            <CitationChips sources={t.sources} />
          </div>
        ))}

        {ask.isPending && (
          <div role="status" aria-live="polite" style={{ fontSize: 13, color: "#6b7280", padding: "4px 0" }}>
            {"…"} Thinking
          </div>
        )}

        {friendly && (
          <div role="alert" aria-live="assertive" style={{ marginTop: 6, padding: "10px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#b91c1c" }}>{friendly.title}</div>
            <div style={{ fontSize: 12, color: "#7f1d1d", marginTop: 2 }}>{friendly.message}</div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ padding: "12px 16px", borderTop: "1px solid #eef0f2" }}>
        <label
          htmlFor="advisor-question"
          style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}
        >
          Ask about this shipment
        </label>
        <textarea
          id="advisor-question"
          className="ss-inp"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          maxLength={ADVISOR_MAX_QUESTION_LENGTH}
          rows={2}
          placeholder={mode === "shipping"
            ? "e.g. Which option is cheapest for a fragile item?"
            : "e.g. My package is delayed — what should I do?"}
          style={{ width: "100%", resize: "vertical", minHeight: 44 }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: 11, color: overLimit ? "#dc2626" : "#9ca3af" }}>
            {input.length}/{ADVISOR_MAX_QUESTION_LENGTH}
          </span>
          <button
            type="submit"
            className="ss-btn ss-btn-primary ss-btn-sm"
            disabled={!canSend}
            aria-disabled={!canSend}
            style={{ opacity: canSend ? 1 : 0.5, cursor: canSend ? "pointer" : "not-allowed" }}
          >
            {ask.isPending ? "Asking…" : "Ask"}
          </button>
        </div>
      </form>
    </section>
  );
}
