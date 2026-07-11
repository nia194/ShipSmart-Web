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

// Product Roadmap §6 vocabulary (the structured assistant contract).
export type AssistantIntent =
  | "form_fill"
  | "form_edit"
  | "quote_search"
  | "recommendation"
  | "compare_options"
  | "policy_question"
  | "package_help"
  | "tracking_question"
  | "general_question";
export type ApplyPolicy = "auto" | "confirm" | "none";
export type ResultLabel = "Cheapest" | "Fastest" | "Best value" | "Safest";

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

// ── Typed result union (Product Roadmap §6) — rendered as a card per type ─────
export interface NextQuestion {
  field: string;
  text: string;
}

export interface ShippingOptionResult {
  type: "shipping_option";
  label: ResultLabel;
  quote_id: string;
  carrier: string;
  service_name: string;
  price_usd: number;
  transit_days: number;
  estimated_delivery_date?: string | null;
  reason: string;
  badges: string[];
}

export interface ComparisonResult {
  type: "comparison";
  options: string[];
  summary: string;
}

export interface MissingInfoResult {
  type: "missing_info";
  missing_fields: string[];
  next_question: string;
}

export interface PolicyAnswerResult {
  type: "policy_answer";
  answer: string;
  sources: SourceCitation[];
}

export type AssistantResult =
  | ShippingOptionResult
  | ComparisonResult
  | MissingInfoResult
  | PolicyAnswerResult;

// ── Grid action bus (Product Roadmap §6/§12) — typed, allowlisted grid controls ──
export type SortBy = "cheapest" | "fastest" | "best_value";

export interface GridFilter {
  price_under?: number | null;
  arrives_by?: string | null;
  carrier_not: string[];
}

export interface SortGridAction {
  type: "sort_grid";
  by: SortBy;
}

export interface FilterGridAction {
  type: "filter_grid";
  grid_filter: GridFilter;
}

export interface SuggestAction {
  type: "suggest";
  chips: string[];
}

export type GridAction = SortGridAction | FilterGridAction | SuggestAction;

export interface ToolCallTrace {
  name: string;
  args_shape: string[];
  status: string;
  latency_ms: number;
}

export interface AssistantAudit {
  model: string;
  provider: string;
  selection_method: string;
  latency_ms: number;
}

export interface AssistantResponse {
  type: ResponseType;
  message: string;
  sources: SourceCitation[];
  actions: Action[];
  form_patch?: FormPatchProposal | null;
  risk_tier: RiskTier;
  requires_confirmation: boolean;
  // ── Product Roadmap §6 additions (additive; old fields keep their meaning) ──
  schema_version: string;
  intent?: AssistantIntent | null;
  apply_policy: ApplyPolicy;
  confidence: number;
  missing_fields: string[];
  next_question?: NextQuestion | null;
  result?: AssistantResult | null;
  grid_actions: GridAction[];
  tool_calls: ToolCallTrace[];
  audit?: AssistantAudit | null;
}
