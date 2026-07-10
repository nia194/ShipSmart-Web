/**
 * Explicit feedback on an AI reply (Governance & Guardrails §6.6 — the
 * Layer-6 online eval loop).
 *
 * A thumbs-up/down plus optional category/comment, posted fire-and-forget to
 * ShipSmart-API's /api/v1/feedback. The backend stores it PII-redacted and
 * pseudonymized in the append-only AI event stream; sampled feedback becomes
 * candidate eval cases after human review. Feedback must never break the
 * surface that asked for it, so `sendFeedback` resolves false on any failure
 * instead of throwing.
 *
 * Reuses the shared `http` wrapper (correlation IDs + Supabase JWT +
 * ProblemDetail parsing) — NO second fetch pattern.
 */
import { pythonApi } from "@/config/api";
import { http } from "@/lib/http";

export type FeedbackRating = "up" | "down";

export interface FeedbackPayload {
  rating: FeedbackRating;
  session_id?: string | null;
  message_id?: string;
  category?: string;
  comment?: string;
}

interface FeedbackResponse {
  status: string;
}

/** Mirrors the server-side cap on the free-text comment. */
export const FEEDBACK_MAX_COMMENT_LENGTH = 2000;

/** POST one feedback signal; resolves false (never throws) on any failure. */
export async function sendFeedback(payload: FeedbackPayload): Promise<boolean> {
  const comment = (payload.comment ?? "").slice(0, FEEDBACK_MAX_COMMENT_LENGTH);
  try {
    const res = await http<FeedbackResponse>(pythonApi.feedback(), {
      method: "POST",
      body: JSON.stringify({
        rating: payload.rating,
        session_id: payload.session_id ?? null,
        message_id: payload.message_id ?? "",
        category: payload.category ?? "",
        comment,
      }),
    });
    return res.status === "recorded";
  } catch {
    return false; // advisory-only telemetry — swallow, never disrupt the UI
  }
}
