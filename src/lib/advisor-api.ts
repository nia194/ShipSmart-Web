/**
 * Typed client for the shipment-scoped advisor.
 *
 * Reuses the shared `http` wrapper (correlation IDs + Supabase JWT + ProblemDetail
 * parsing) — NO second fetch pattern. Talks to ShipSmart-API (Python) for advice
 * and, optionally, to ShipSmart-Orchestrator (Java) read-only to hydrate context.
 *
 * Field shapes mirror the cross-repo contracts:
 *   - ShipSmart-API advisor responses (incl. additive `decision_path` / `source`)
 *   - ShipSmart-Orchestrator `GET /api/v1/shipments/{id}` (ShipmentSummaryDto)
 */
import { javaApi, pythonApi } from "@/config/api";
import { http, HttpError } from "@/lib/http";

// ── Backend response shapes (snake_case, matching ShipSmart-API) ─────────────

export interface AdvisorSource {
  source: string;
  chunk_index: number;
  score: number;
}

export type AnswerProvenance = "rule" | "llm" | "fallback";

/** Additive decision-path tag from ShipSmart-API (E). */
export interface DecisionPath {
  mode: string;       // "normal" | "agentic"
  retrieval: string;  // "dense" | "hybrid" | "none"
  answer: AnswerProvenance;
  provider: string;
  tags: string[];
}

/** One chat message referenced by a reply (the replied-to message, or a recent turn). */
export interface ReplyMessage {
  role: "user" | "assistant";
  text: string;
}

/** Optional reply-to context for a follow-up question (WhatsApp-style reply). */
export interface ReplyContext {
  reply_to?: ReplyMessage;
  recent_history?: ReplyMessage[];
}

/** Context forwarded to the advisor. Only keys the backend recognizes. */
export interface AdvisorContext {
  origin_zip?: string;
  destination_zip?: string;
  weight_lbs?: number;
  length_in?: number;
  width_in?: number;
  height_in?: number;
  drop_off_date?: string;
  expected_delivery_date?: string;
}

export interface ShippingAdvisorResponse {
  answer: string;
  reasoning_summary: string;
  tools_used: string[];
  sources: AdvisorSource[];
  context_used: boolean;
  decision_path?: DecisionPath | null;
}

export interface TrackingAdvisorResponse {
  guidance: string;
  issue_summary: string;
  tools_used: string[];
  sources: AdvisorSource[];
  next_steps: string[];
  decision_path?: DecisionPath | null;
}

/** Mirrors ShipSmart-Orchestrator GET /api/v1/shipments/{id} (ShipmentSummaryDto). */
export interface ShipmentSummary {
  id: string;
  origin: string;
  destination: string;
  dropOffDate: string | null;
  expectedDeliveryDate: string | null;
  totalWeight: number | null;
  totalItems: number | null;
  status: "DRAFT" | "QUOTED" | "BOOKED" | "CANCELLED";
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ── Client calls (all via the shared `http` wrapper) ─────────────────────────

export function postShippingAdvice(
  query: string,
  context: AdvisorContext,
  reply?: ReplyContext,
): Promise<ShippingAdvisorResponse> {
  return http<ShippingAdvisorResponse>(pythonApi.advisorShipping(), {
    method: "POST",
    body: JSON.stringify({
      query,
      context,
      reply_to: reply?.reply_to ?? null,
      recent_history: reply?.recent_history ?? null,
    }),
  });
}

export function postTrackingAdvice(
  issue: string,
  context: AdvisorContext,
): Promise<TrackingAdvisorResponse> {
  return http<TrackingAdvisorResponse>(pythonApi.advisorTracking(), {
    method: "POST",
    body: JSON.stringify({ issue, context }),
  });
}

/** Read-only, JWT-scoped fetch of a persisted shipment (context hydration). */
export function fetchShipment(id: string): Promise<ShipmentSummary> {
  return http<ShipmentSummary>(javaApi.shipment(id));
}

/** Map a persisted shipment to advisor context so the user needn't retype it. */
export function shipmentToContext(s: ShipmentSummary): AdvisorContext {
  return {
    origin_zip: s.origin,
    destination_zip: s.destination,
    weight_lbs: s.totalWeight ?? undefined,
    drop_off_date: s.dropOffDate ?? undefined,
    expected_delivery_date: s.expectedDeliveryDate ?? undefined,
  };
}

// ── Error taxonomy → friendly, non-technical states (C) ──────────────────────

export interface FriendlyError {
  title: string;
  message: string;
}

/**
 * Map the backend LLM error taxonomy (surfaced as HTTP status on HttpError) to
 * friendly copy. Only governs the advisor panel — transactional flows
 * (quotes/saved options/booking) are never affected by this.
 */
export function friendlyAdvisorError(err: unknown): FriendlyError {
  const status = err instanceof HttpError ? err.status : 0;
  switch (status) {
    case 429:
      return {
        title: "Advisor is busy",
        message: "High demand right now — give it a moment and try again.",
      };
    case 502:
    case 503:
      return {
        title: "Temporarily unavailable",
        message: "The advisor is unavailable right now. Your quotes and bookings are unaffected.",
      };
    case 504:
      return {
        title: "Took too long",
        message: "That request timed out — please try again.",
      };
    case 422:
      return {
        title: "Can't help with that",
        message: "I can't help with that request. Try rephrasing your question.",
      };
    case 400:
      return {
        title: "Too long",
        message: "Your question or shipment context is too long — shorten it and try again.",
      };
    case 401:
    case 403:
      return {
        title: "Sign in needed",
        message: "Please sign in to ask the advisor about your shipment.",
      };
    default:
      return {
        title: "Something went wrong",
        message: "Couldn't get an answer just now. Please try again.",
      };
  }
}

/** Max question length — mirrors the server-side advisor input cap (D). */
export const ADVISOR_MAX_QUESTION_LENGTH = 2000;
