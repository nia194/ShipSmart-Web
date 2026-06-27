/**
 * Conversational Concierge panel.
 *
 * A multi-turn chat that is a second view over the shared ShipmentDraft store: it
 * sends the draft as the conversation state each turn (so the server never re-asks
 * for fields the form already has) and patches the form with any newly-extracted
 * entities the server echoes back. A genuine chat-vs-form conflict is surfaced as a
 * one-line confirm rather than silently overwriting. Gated by VITE_USE_CONCIERGE.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";

import { friendlyAdvisorError } from "@/lib/advisor-api";
import {
  CONCIERGE_MAX_MESSAGE_LENGTH,
  getConciergeHistory,
  postConciergeChat,
  type ConciergeState,
} from "@/lib/concierge-api";
import { useShipmentDraft } from "@/state/ShipmentDraftContext";
import { conciergeStateToPatch, draftToConciergeState, emptyDraft } from "@/state/shipmentDraft";

/** localStorage key holding the anonymous concierge session id (for reload recall). */
const SESSION_KEY = "ss_concierge_session";

interface Turn {
  id: number;
  question: string;
  reply: string;
  dispatched?: string | null;
}

/** A friendly tag for where a turn was handled (only the "rich" workers are shown). */
const DISPATCH_LABEL: Record<string, string> = {
  workflow: "✦ full shipment workflow",
  compliance: "✦ compliance check",
};

const FIELD_LABEL: Record<string, string> = {
  origin: "origin",
  destination: "destination",
  originCountry: "origin country",
  destinationCountry: "destination country",
  dropOffDate: "drop-off date",
  deliveryDate: "delivery date",
  weightLbs: "weight",
  priority: "priority",
  description: "description",
  declaredValueUsd: "declared value",
};

export default function ConciergePanel() {
  const { draft, applyPatch, conflicts, resolveConflict, reset } = useShipmentDraft();
  const [thread, setThread] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [convState, setConvState] = useState<ConciergeState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(
    () => (typeof localStorage !== "undefined" ? localStorage.getItem(SESSION_KEY) : null),
  );
  const [replyTarget, setReplyTarget] = useState<{ role: "assistant"; text: string } | null>(null);
  const seq = useRef(0);
  const recalled = useRef(false);

  // Recall a prior conversation after a page reload (best-effort): replay the
  // transcript and hydrate the shared draft from the persisted merged state.
  useEffect(() => {
    if (recalled.current || !sessionId) return;
    recalled.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const hist = await getConciergeHistory(sessionId);
        if (cancelled) return;
        const turns: Turn[] = [];
        let question: string | null = null;
        for (const m of hist.messages) {
          if (m.role === "user") question = m.content;
          else if (m.role === "assistant") {
            turns.push({ id: seq.current++, question: question ?? "", reply: m.content });
            question = null;
          }
        }
        setThread(turns);
        setConvState(hist.state);
        const patch = conciergeStateToPatch(hist.state, emptyDraft());
        if (Object.keys(patch).length > 0) applyPatch(patch, "hydrated");
      } catch {
        // Unknown / expired session — start fresh.
        if (typeof localStorage !== "undefined") localStorage.removeItem(SESSION_KEY);
        setSessionId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, applyPatch]);

  const trimmed = input.trim();
  const overLimit = input.length > CONCIERGE_MAX_MESSAGE_LENGTH;
  const canSend = trimmed.length >= 2 && !overLimit && !pending;

  const send = async () => {
    if (!canSend) return;
    setPending(true);
    setError(null);
    const target = replyTarget;
    const reply = target
      ? {
          reply_to: { role: target.role, text: target.text },
          recent_history: thread
            .flatMap((t) => [
              { role: "user" as const, text: t.question },
              { role: "assistant" as const, text: t.reply },
            ])
            .slice(-6),
        }
      : undefined;
    setReplyTarget(null);
    try {
      const resp = await postConciergeChat(
        trimmed, draftToConciergeState(draft, convState), sessionId, reply,
      );
      if (resp.session_id && resp.session_id !== sessionId) {
        setSessionId(resp.session_id);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(SESSION_KEY, resp.session_id);
        }
      }
      setThread((prev) => [
        ...prev,
        {
          id: seq.current++, question: trimmed,
          reply: resp.reply, dispatched: resp.dispatched_to,
        },
      ]);
      setConvState(resp.state);
      const patch = conciergeStateToPatch(resp.state, draft);
      if (Object.keys(patch).length > 0) applyPatch(patch, "chat");
      setInput("");
    } catch (e) {
      setError(friendlyAdvisorError(e).message);
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send();
  };

  const startOver = () => {
    reset();
    setThread([]);
    setConvState(null);
    setInput("");
    setError(null);
    setSessionId(null);
    setReplyTarget(null);
    recalled.current = true; // a fresh, intentional session — don't re-recall the old one
    if (typeof localStorage !== "undefined") localStorage.removeItem(SESSION_KEY);
  };

  return (
    <section
      className="ss-card"
      aria-label="Shipping concierge"
      style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #eef0f2" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{"💬"} Shipping concierge</span>
        <button type="button" className="ss-btn ss-btn-outline ss-btn-sm" onClick={startOver}>
          Start over
        </button>
      </div>

      <div style={{ padding: "12px 16px", maxHeight: 320, overflowY: "auto" }}>
        {thread.length === 0 && !pending && (
          <p style={{ fontSize: 13, color: "#9ca3af", margin: "4px 0" }}>
            Tell me about your shipment in plain English — e.g. "Atlanta to Seattle,
            12 lb, by Friday". I'll fill in the form as we go.
          </p>
        )}

        {thread.map((t) => (
          <div key={t.id} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 6 }}>{t.question}</div>
            <div style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{t.reply}</div>
            {t.dispatched && DISPATCH_LABEL[t.dispatched] && (
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                {DISPATCH_LABEL[t.dispatched]}
              </div>
            )}
            <button
              type="button"
              onClick={() => setReplyTarget({ role: "assistant", text: t.reply })}
              style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: "#9ca3af", background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              ↩ Reply
            </button>
          </div>
        ))}

        {pending && (
          <div role="status" aria-live="polite" style={{ fontSize: 13, color: "#6b7280", padding: "4px 0" }}>
            {"…"} Thinking
          </div>
        )}

        {error && (
          <div role="alert" style={{ marginTop: 6, padding: "10px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", fontSize: 12, color: "#b91c1c" }}>
            {error}
          </div>
        )}

        {conflicts.map((c) => (
          <div key={c.field} role="alert" style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a" }}>
            <div style={{ fontSize: 12, color: "#92400e", marginBottom: 8 }}>
              Your form has <strong>{String(c.current)}</strong> for{" "}
              {FIELD_LABEL[c.field] ?? c.field}, but chat suggests{" "}
              <strong>{String(c.incoming)}</strong>. Which should I use?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="ss-btn ss-btn-outline ss-btn-sm" onClick={() => resolveConflict(c.field, "current")}>
                Keep {String(c.current)}
              </button>
              <button type="button" className="ss-btn ss-btn-primary ss-btn-sm" onClick={() => resolveConflict(c.field, "incoming")}>
                Use {String(c.incoming)}
              </button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ padding: "12px 16px", borderTop: "1px solid #eef0f2" }}>
        {replyTarget && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8, padding: "6px 10px", borderRadius: 8, background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {"↩ Replying to advisor: "}{replyTarget.text.slice(0, 80)}
            </span>
            <button
              type="button"
              onClick={() => setReplyTarget(null)}
              aria-label="Cancel reply"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        )}
        <label htmlFor="concierge-input" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          Message the concierge
        </label>
        <textarea
          id="concierge-input"
          className="ss-inp"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void send();
            }
          }}
          maxLength={CONCIERGE_MAX_MESSAGE_LENGTH}
          rows={2}
          placeholder="e.g. Ship from Atlanta to Seattle, 12 lb, by Friday"
          style={{ width: "100%", resize: "vertical", minHeight: 44 }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: 11, color: overLimit ? "#dc2626" : "#9ca3af" }}>
            {input.length}/{CONCIERGE_MAX_MESSAGE_LENGTH}
          </span>
          <button
            type="submit"
            className="ss-btn ss-btn-primary ss-btn-sm"
            disabled={!canSend}
            aria-disabled={!canSend}
            style={{ opacity: canSend ? 1 : 0.5, cursor: canSend ? "pointer" : "not-allowed" }}
          >
            {pending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}
