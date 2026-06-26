/**
 * Typed client for the Conversational Concierge (POST /api/v1/concierge/chat).
 *
 * A stateful, multi-turn slot-filling chat. The client OWNS the ConversationState
 * and echoes it back each turn (no server store); `slots` are the shared
 * shipment-context superset the form and the chat both populate. Reuses the shared
 * `http` wrapper (correlation IDs + JWT + RFC-7807 parsing).
 */
import { pythonApi } from "@/config/api";
import type { AdvisorSource } from "@/lib/advisor-api";
import { http } from "@/lib/http";

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
  clarification: string | null;
  dispatched_to: string | null;
  sources: AdvisorSource[];
  decisions: string[];
  provider: string;
}

/** Max message length — mirrors the server-side concierge input cap. */
export const CONCIERGE_MAX_MESSAGE_LENGTH = 2000;

export function postConciergeChat(
  message: string,
  state: ConciergeState | null,
): Promise<ConciergeResponse> {
  return http<ConciergeResponse>(pythonApi.conciergeChat(), {
    method: "POST",
    body: JSON.stringify({ message, state }),
  });
}
