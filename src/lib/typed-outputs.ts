/**
 * Typed model-output shapes (Governance & Guardrails Control System §5.3).
 *
 * The AI boundary returns typed data the product renders or rejects — never
 * trusted prose. These interfaces mirror ShipSmart-API `app/schemas/typed_outputs.py`
 * field-for-field (snake_case); the ShipSmart-Test contract suite asserts they line up.
 *
 * F1 ships the shapes + the API validator; the typed-card renderer that consumes
 * them is a later product phase.
 */

// ── Constrained value sets (mirror the Python Literals) ──────────────────────
export type RiskTier = "read" | "quote" | "write" | "high";
export type PatchSource = "user_text" | "tool_result" | "quote_data";
export type ResponseType = "answer" | "form_patch" | "ask_followup" | "refusal";

// ── Backend shapes (snake_case, matching ShipSmart-API) ──────────────────────

export interface SourceCitation {
  source: string;
  chunk_index?: number | null;
  score?: number | null;
}

export interface Action {
  name: string;
  risk_tier: RiskTier;
  params: Record<string, unknown>;
  requires_confirmation: boolean;
}

export interface FieldPatch {
  field_path: string;
  new_value: unknown;
  old_value?: unknown;
  confidence: number;
  reason: string;
  source: PatchSource;
  requires_confirmation: boolean;
}

export interface FormPatchProposal {
  patches: FieldPatch[];
}

export interface Refusal {
  reason: string;
  safe_message: string;
  tag: string;
}

export interface ToolCallPolicy {
  tool_name: string;
  version: string;
  risk_tier: RiskTier;
  allowed_routes: string[];
  max_calls_per_request: number;
  requires_confirmation: boolean;
}

export interface AssistantResponse {
  type: ResponseType;
  message: string;
  sources: SourceCitation[];
  actions: Action[];
  form_patch?: FormPatchProposal | null;
  risk_tier: RiskTier;
  requires_confirmation: boolean;
}
