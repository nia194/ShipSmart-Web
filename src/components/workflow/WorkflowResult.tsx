/**
 * Workflow result view (UC3/UC4).
 *
 * Renders the finished (or suspended) workflow state: status, classification,
 * landed cost, recommended carrier, the advisory compliance summary, generated
 * documents, and the full decision trail (the audit story — collapsed).
 */
import { useState } from "react";

import { isDomesticOnly } from "@/config/api";
import { type WorkflowResponse, verdictLabel } from "@/lib/workflow-api";

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  completed: { bg: "#dcfce7", fg: "#166534" },
  awaiting_review: { bg: "#fef3c7", fg: "#b45309" },
  blocked: { bg: "#fee2e2", fg: "#991b1b" },
  running: { bg: "#e0f2fe", fg: "#0369a1" },
  pending: { bg: "#f3f4f6", fg: "#374151" },
  failed: { bg: "#fee2e2", fg: "#991b1b" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999,
      background: s.bg, color: s.fg, letterSpacing: 0.2,
    }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#fff",
};
const h: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 4 };

export function WorkflowResult({ state }: { state: WorkflowResponse }) {
  const [showTrail, setShowTrail] = useState(false);
  const lc = state.landed_cost;
  const rc = state.recommended_carrier;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <StatusBadge status={state.status} />
        <span style={{ fontSize: 12, color: "#9ca3af" }}>id: {state.workflow_id.slice(0, 12)}…</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={card}>
          <div style={h}>Classification</div>
          <div style={{ fontSize: 14 }}>
            {state.hs_code ? <><strong>{state.hs_code}</strong> — {state.hs_title}</> : "—"}
          </div>
        </div>
        {/* Landed cost is duties + customs — an international concern; hidden when domestic. */}
        {!isDomesticOnly && (
          <div style={card}>
            <div style={h}>Landed cost</div>
            <div style={{ fontSize: 14 }}>
              {lc ? <>${lc.total_landed_usd.toFixed(2)} <span style={{ color: "#9ca3af", fontSize: 12 }}>
                (duty ${lc.duty_usd.toFixed(2)} + {lc.tax_label} ${lc.tax_usd.toFixed(2)})</span></> : "—"}
            </div>
            {lc?.trade_note && <div style={{ fontSize: 11, color: "#16a34a" }}>{lc.trade_note}</div>}
          </div>
        )}
        <div style={card}>
          <div style={h}>Recommended carrier</div>
          <div style={{ fontSize: 14 }}>
            {rc ? <>{rc.carrier} {rc.service} — ${rc.price_usd.toFixed(2)}, {rc.estimated_days}d</> : "—"}
          </div>
        </div>
        <div style={card}>
          <div style={h}>Compliance</div>
          {state.compliance ? (
            <div style={{ fontSize: 14 }}>
              <strong>{verdictLabel(state.compliance.verdict)}</strong>
              {state.compliance.unverified_areas.length > 0 && (
                <div style={{ fontSize: 11, color: "#b45309" }}>
                  unverified: {state.compliance.unverified_areas.join(", ")}
                </div>
              )}
            </div>
          ) : "—"}
        </div>
      </div>

      {state.documents.length > 0 && (
        <div style={card}>
          <div style={h}>Documents</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {state.documents.map((d) => (
              <span key={d.doc_type} style={{
                fontSize: 12, padding: "2px 8px", borderRadius: 6, background: "#eef2ff", color: "#3730a3",
              }}>{d.title}</span>
            ))}
          </div>
        </div>
      )}

      <div>
        <button type="button" onClick={() => setShowTrail((v) => !v)}
          style={{
            fontSize: 12, fontWeight: 600, color: "#0071e3", background: "none",
            border: "none", cursor: "pointer", padding: 0,
          }}>
          {showTrail ? "Hide" : "Show"} decision trail ({state.decisions.length})
        </button>
        {showTrail && (
          <pre style={{
            marginTop: 8, padding: 10, background: "#0b1021", color: "#cbd5e1", borderRadius: 8,
            fontSize: 11, lineHeight: 1.5, overflowX: "auto", whiteSpace: "pre-wrap",
          }}>{state.decisions.join(" · ")}</pre>
        )}
      </div>
    </div>
  );
}
