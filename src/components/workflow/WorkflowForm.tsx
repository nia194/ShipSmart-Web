/**
 * Workflow input form (UC3).
 *
 * Collects a shipment and submits it to the multi-agent workflow. Country codes
 * are ISO-2 (the server derives `international`); description drives the
 * compliance/classification analysis.
 */
import type { FormEvent } from "react";
import { useState } from "react";

import { apiConfig, isDomesticOnly } from "@/config/api";
import {
  WORKFLOW_MAX_DESCRIPTION_LENGTH,
  type WorkflowProcessRequest,
} from "@/lib/workflow-api";

interface WorkflowFormProps {
  onSubmit: (body: WorkflowProcessRequest) => void;
  busy?: boolean;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  border: "1px solid #d1d5db", fontSize: 14,
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4,
};

export function WorkflowForm({ onSubmit, busy = false }: WorkflowFormProps) {
  // Domestic-only deployments pin both ends to the home country and hide the
  // country fields; worldwide keeps the cross-border inputs.
  const home = apiConfig.domesticCountry.toUpperCase();
  const [origin, setOrigin] = useState(isDomesticOnly ? home : "US");
  const [destination, setDestination] = useState(isDomesticOnly ? home : "BR");
  const [value, setValue] = useState("600");
  const [weight, setWeight] = useState("3");
  const [description, setDescription] = useState("camera drone with lithium battery");
  const [category, setCategory] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      origin_country: isDomesticOnly ? home : origin.trim().toUpperCase(),
      destination_country: isDomesticOnly ? home : destination.trim().toUpperCase(),
      declared_value_usd: Number(value) || 0,
      weight_lbs: Number(weight) || 0,
      description: description.slice(0, WORKFLOW_MAX_DESCRIPTION_LENGTH),
      category: category.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      {isDomesticOnly ? (
        <div style={{
          gridColumn: "1 / -1", fontSize: 12, color: "#374151",
          background: "#f3f4f6", borderRadius: 8, padding: "8px 10px",
        }}>
          Shipping within <strong>{home}</strong> only (domestic).
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {!isDomesticOnly && (
          <>
            <div>
              <label style={labelStyle} htmlFor="wf-origin">Origin (ISO-2)</label>
              <input id="wf-origin" style={inputStyle} value={origin} maxLength={2}
                onChange={(e) => setOrigin(e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle} htmlFor="wf-dest">Destination (ISO-2)</label>
              <input id="wf-dest" style={inputStyle} value={destination} maxLength={2}
                onChange={(e) => setDestination(e.target.value)} required />
            </div>
          </>
        )}
        <div>
          <label style={labelStyle} htmlFor="wf-value">Declared value (USD)</label>
          <input id="wf-value" style={inputStyle} type="number" min={0} value={value}
            onChange={(e) => setValue(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="wf-weight">Weight (lbs)</label>
          <input id="wf-weight" style={inputStyle} type="number" min={0} value={weight}
            onChange={(e) => setWeight(e.target.value)} />
        </div>
      </div>
      <div>
        <label style={labelStyle} htmlFor="wf-desc">Description</label>
        <input id="wf-desc" style={inputStyle} value={description}
          onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div>
        <label style={labelStyle} htmlFor="wf-cat">Category (optional)</label>
        <input id="wf-cat" style={inputStyle} value={category}
          onChange={(e) => setCategory(e.target.value)} />
      </div>
      <button type="submit" disabled={busy}
        className="ss-btn ss-btn-primary"
        style={{
          padding: "10px 16px", borderRadius: 8, border: "none", cursor: busy ? "default" : "pointer",
          background: busy ? "#9ca3af" : "#0071e3", color: "#fff", fontWeight: 700, fontSize: 14,
        }}>
        {busy ? "Processing…" : "Run workflow"}
      </button>
    </form>
  );
}
