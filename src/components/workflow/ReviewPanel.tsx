/**
 * Human-in-the-loop review panel (UC4).
 *
 * Shown when a workflow is `awaiting_review` because a high-risk area could not be
 * auto-verified. The officer clears (continue to documentation) or blocks
 * (terminate), with an audited note.
 */
import { useState } from "react";

import type { Determination } from "@/lib/workflow-api";

interface ReviewPanelProps {
  pendingAreas: string[];
  onReview: (determination: Determination, note: string) => void;
  busy?: boolean;
}

export function ReviewPanel({ pendingAreas, onReview, busy = false }: ReviewPanelProps) {
  const [note, setNote] = useState("");

  return (
    <div style={{
      border: "1px solid #f59e0b", background: "#fffbeb", borderRadius: 12, padding: 16,
    }}>
      <div style={{ fontWeight: 800, color: "#b45309", marginBottom: 6 }}>
        Human review needed
      </div>
      <p style={{ fontSize: 13, color: "#92400e", margin: "0 0 10px" }}>
        These high-risk areas could not be verified automatically:{" "}
        <strong>{pendingAreas.join(", ") || "—"}</strong>. Clear to continue, or block to stop.
      </p>
      <textarea
        aria-label="Reviewer note"
        placeholder="Optional note (recorded in the audit trail)…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        style={{
          width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db",
          fontSize: 13, marginBottom: 10, resize: "vertical",
        }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={busy} onClick={() => onReview("cleared", note)}
          style={{
            padding: "8px 14px", borderRadius: 8, border: "none", cursor: busy ? "default" : "pointer",
            background: "#16a34a", color: "#fff", fontWeight: 700, fontSize: 13,
          }}>
          Clear & continue
        </button>
        <button type="button" disabled={busy} onClick={() => onReview("blocked", note)}
          style={{
            padding: "8px 14px", borderRadius: 8, border: "none", cursor: busy ? "default" : "pointer",
            background: "#dc2626", color: "#fff", fontWeight: 700, fontSize: 13,
          }}>
          Block shipment
        </button>
      </div>
    </div>
  );
}
