/**
 * Typed client for the Conversational Concierge (POST /api/v1/concierge/chat).
 *
 * A stateful, multi-turn slot-filling chat. The client echoes the ConversationState
 * each turn; `slots` are the shared shipment-context superset the form and the chat
 * both populate. Conversation memory is server-side and keyed by an anonymous
 * `session_id` (minted by the server, persisted client-side) so the chat can be
 * RECALLED after a page reload via `getConciergeHistory`. Reuses the shared `http`
 * wrapper (correlation IDs + JWT + RFC-7807 parsing).
 */
import { pythonApi } from "@/config/api";
import type { AdvisorSource, ReplyContext } from "@/lib/advisor-api";
import { http } from "@/lib/http";
import type { AssistantResponse } from "@/lib/typed-outputs";

export interface ConciergeState {
  slots: Record<string, unknown>;
  intent: string | null;
  status: string;
  pending_clarification: string | null;
  turns: number;
}

export interface ConciergeResponse {
  reply: string;
  state: ConciergeState;
  session_id: string | null;
  clarification: string | null;
  dispatched_to: string | null;
  sources: AdvisorSource[];
  decisions: string[];
  provider: string;
  // Structured assistant contract (Product Roadmap §6). Present only when the
  // backend has ASSISTANT_CONTRACT_V1 enabled; the UI renders types when it is,
  // and plain prose when it is null.
  assistant?: AssistantResponse | null;
}

export interface ConciergeMessage {
  role: string; // "user" | "assistant"
  content: string;
  created_at: string;
}

export interface ConciergeHistoryResponse {
  session_id: string;
  state: ConciergeState;
  messages: ConciergeMessage[];
}

/** Max message length — mirrors the server-side concierge input cap. */
export const CONCIERGE_MAX_MESSAGE_LENGTH = 2000;

export function postConciergeChat(
  message: string,
  state: ConciergeState | null,
  sessionId?: string | null,
  reply?: ReplyContext,
): Promise<ConciergeResponse> {
  return http<ConciergeResponse>(pythonApi.conciergeChat(), {
    method: "POST",
    body: JSON.stringify({
      message,
      state,
      session_id: sessionId ?? null,
      reply_to: reply?.reply_to ?? null,
      recent_history: reply?.recent_history ?? null,
    }),
  });
}

/** Fetch the persisted transcript + merged state to rehydrate after a reload. */
export function getConciergeHistory(sessionId: string): Promise<ConciergeHistoryResponse> {
  return http<ConciergeHistoryResponse>(pythonApi.conciergeHistory(sessionId), {
    method: "GET",
  });
}
