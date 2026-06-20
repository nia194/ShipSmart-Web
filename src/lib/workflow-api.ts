/**
 * Typed client for the multi-agent workflow (UC3/UC4).
 *
 * Reuses the shared `http` wrapper (correlation IDs + Supabase JWT + ProblemDetail
 * parsing) — NO second fetch pattern. Talks to ShipSmart-API (Python) /workflow.
 *
 * Field shapes mirror the cross-repo contract verbatim (snake_case), matching
 * ShipSmart-API `app/schemas/workflow.py` + `app/schemas/compliance.py` + the
 * frozen domain models. The ShipSmart-Test contract suite asserts these line up.
 */
import { pythonApi } from "@/config/api";
import { http, HttpError } from "@/lib/http";

// ── Backend shapes (snake_case, matching ShipSmart-API) ──────────────────────

export interface HsCandidate {
  hs_code: string;
  title: string;
  confidence: number;
}

export interface DutyQuote {
  hs_code: string;
  destination: string;
  value_usd: number;
  duty_pct: number;
  duty_usd: number;
  tax_label: string;
  tax_pct: number;
  tax_usd: number;
  total_landed_usd: number;
  trade_note: string;
}

export interface CarrierQuote {
  carrier: string;
  service: string;
  price_usd: number;
  estimated_days: number;
}

export interface GeneratedDoc {
  doc_type: string;
  title: string;
  fields: Record<string, string>;
}

export interface ComplianceSummary {
  verdict: string;
  summary: string;
  flagged_areas: string[];
  unverified_areas: string[];
  critique_rounds: number;
  provider: string;
}

export type WorkflowStatus =
  | "pending"
  | "running"
  | "completed"
  | "awaiting_review"
  | "blocked"
  | "failed";

export interface WorkflowResponse {
  workflow_id: string;
  status: WorkflowStatus;
  hs_code: string;
  hs_title: string;
  hs_candidates: HsCandidate[];
  landed_cost: DutyQuote | null;
  carrier_quotes: CarrierQuote[];
  recommended_carrier: CarrierQuote | null;
  compliance: ComplianceSummary | null;
  documents: GeneratedDoc[];
  pending_review_areas: string[];
  officer_determination: string;
  officer_note: string;
  decisions: string[];
}

export interface WorkflowProcessRequest {
  origin_country: string;
  destination_country: string;
  declared_value_usd: number;
  weight_lbs: number;
  description: string;
  category?: string | null;
}

export type Determination = "cleared" | "blocked";

export interface WorkflowReviewRequest {
  determination: Determination;
  note: string;
}

// ── Client calls (all via the shared `http` wrapper) ─────────────────────────

export function postWorkflowProcess(
  body: WorkflowProcessRequest,
): Promise<WorkflowResponse> {
  return http<WorkflowResponse>(pythonApi.workflowProcess(), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getWorkflow(id: string): Promise<WorkflowResponse> {
  return http<WorkflowResponse>(pythonApi.workflow(id));
}

export function postWorkflowReview(
  id: string,
  body: WorkflowReviewRequest,
): Promise<WorkflowResponse> {
  return http<WorkflowResponse>(pythonApi.workflowReview(id), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Error taxonomy → friendly, non-technical copy ────────────────────────────

export interface FriendlyError {
  title: string;
  message: string;
}

/** Map workflow HTTP errors to friendly copy (mirrors the advisor taxonomy). */
export function friendlyWorkflowError(err: unknown): FriendlyError {
  const status = err instanceof HttpError ? err.status : 0;
  switch (status) {
    case 404:
      return { title: "Not found", message: "That workflow no longer exists." };
    case 409:
      return {
        title: "Already resolved",
        message: "This workflow isn't awaiting review — it may already be decided.",
      };
    case 422:
      return {
        title: "Check the details",
        message: "Some shipment fields are invalid — countries must be 2-letter codes.",
      };
    case 429:
      return { title: "Busy", message: "High demand right now — give it a moment." };
    case 502:
    case 503:
      return {
        title: "Temporarily unavailable",
        message: "The workflow service is unavailable right now. Please try again shortly.",
      };
    case 504:
      return { title: "Took too long", message: "That request timed out — please try again." };
    case 401:
    case 403:
      return { title: "Sign in needed", message: "Please sign in to run a workflow." };
    default:
      return {
        title: "Something went wrong",
        message: "Couldn't complete that just now. Please try again.",
      };
  }
}

/** Max description length — mirrors the server-side cap. */
export const WORKFLOW_MAX_DESCRIPTION_LENGTH = 2000;

/** Advisory verdicts are never "compliant"/"cleared"; map to friendly labels. */
export function verdictLabel(verdict: string): string {
  switch (verdict) {
    case "action_required":
      return "Action required";
    case "review_recommended":
      return "Review recommended";
    case "advisory":
      return "Advisory";
    default:
      return verdict;
  }
}
