/**
 * Conversational Concierge panel.
 *
 * A multi-turn chat that is a second view over the shared ShipmentDraft store: it
 * sends the draft as the conversation state each turn (so the server never re-asks
 * for fields the form already has) and patches the form with any newly-extracted
 * entities the server echoes back. A genuine chat-vs-form conflict is surfaced as a
 * one-line confirm rather than silently overwriting. Gated by VITE_USE_CONCIERGE.
 */
import { useRef, useState, type FormEvent } from "react";

import { friendlyAdvisorError } from "@/lib/advisor-api";
import {
  CONCIERGE_MAX_MESSAGE_LENGTH,
  postConciergeChat,
  type ConciergeState,
} from "@/lib/concierge-api";
import { useShipmentDraft } from "@/state/ShipmentDraftContext";
import { conciergeStateToPatch, draftToConciergeState } from "@/state/shipmentDraft";

interface Turn {
  id: number;
  question: string;
  reply: string;
}

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
  const seq = useRef(0);

  const trimmed = input.trim();
  const overLimit = input.length > CONCIERGE_MAX_MESSAGE_LENGTH;
  const canSend = trimmed.length >= 2 && !overLimit && !pending;

  const send = async () => {
    if (!canSend) return;
    setPending(true);
    setError(null);
    try {
      const resp = await postConciergeChat(trimmed, draftToConciergeState(draft, convState));
      setThread((prev) => [...prev, { id: seq.current++, question: trimmed, reply: resp.reply }]);
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
