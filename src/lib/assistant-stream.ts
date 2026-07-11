/**
 * SSE client for the streaming assistant (Product Roadmap P3 — perceived speed).
 *
 * Consumes `POST /api/v1/assistant/stream` (Server-Sent Events): text deltas
 * render progressively as the model generates, and a final `done` event carries
 * the typed `AssistantResponse` the product renders. The shared `http` wrapper
 * buffers JSON and can't stream, so this uses `fetch` directly + the same auth
 * (Supabase bearer) and correlation-id discipline.
 */
import { pythonApi } from "@/config/api";
import { bearer } from "@/lib/http";
import type { AssistantResponse } from "@/lib/typed-outputs";

export type StreamEvent =
  | { delta: string }
  | { done: true; assistant: AssistantResponse }
  | { error: string };

/** Split an SSE buffer into complete events + the unconsumed remainder. */
export function parseSseBuffer(buffer: string): { events: StreamEvent[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: StreamEvent[] = [];
  for (const frame of parts) {
    const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
    if (!dataLine) continue;
    try {
      events.push(JSON.parse(dataLine.slice("data: ".length)) as StreamEvent);
    } catch {
      // ignore a malformed frame rather than break the stream
    }
  }
  return { events, rest };
}

export interface StreamHandlers {
  onDelta?: (text: string) => void;
  onDone?: (assistant: AssistantResponse) => void;
  onError?: (message: string) => void;
}

export interface StreamDeps {
  fetchImpl?: typeof fetch;
  getToken?: () => Promise<string | undefined>;
}

/**
 * Stream a grounded answer from the SSE endpoint, invoking handlers as events
 * arrive. Resolves with the full accumulated text. Never throws — transport
 * failures go to `onError` (streaming telemetry must not crash the surface).
 */
export async function streamAssistant(
  query: string,
  handlers: StreamHandlers = {},
  deps: StreamDeps = {},
): Promise<string> {
  const doFetch = deps.fetchImpl ?? fetch;
  const getToken = deps.getToken ?? bearer;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Request-Id": crypto.randomUUID(),
  };
  const token = await getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await doFetch(pythonApi.assistantStream(), {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });
  } catch (e) {
    handlers.onError?.(e instanceof Error ? e.message : "stream request failed");
    return "";
  }

  if (!res.ok || !res.body) {
    handlers.onError?.(`stream failed (${res.status})`);
    return "";
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseSseBuffer(buffer);
    buffer = rest;
    for (const ev of events) {
      if ("delta" in ev) {
        text += ev.delta;
        handlers.onDelta?.(ev.delta);
      } else if ("done" in ev) {
        handlers.onDone?.(ev.assistant);
      } else if ("error" in ev) {
        handlers.onError?.(ev.error);
      }
    }
  }
  return text;
}
