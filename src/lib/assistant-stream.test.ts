import { describe, expect, it, vi } from "vitest";

import { parseSseBuffer, streamAssistant } from "@/lib/assistant-stream";
import type { AssistantResponse } from "@/lib/typed-outputs";

function envelope(message: string): AssistantResponse {
  return {
    type: "answer",
    message,
    sources: [],
    actions: [],
    risk_tier: "read",
    requires_confirmation: false,
    schema_version: "1",
    apply_policy: "none",
    confidence: 0.7,
    missing_fields: [],
    grid_actions: [],
    tool_calls: [],
    result: { type: "policy_answer", answer: message, sources: [] },
  };
}

function sseResponse(frames: string[], init: { ok?: boolean; status?: number } = {}): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const f of frames) controller.enqueue(enc.encode(f));
      controller.close();
    },
  });
  return new Response(body, {
    status: init.status ?? 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("parseSseBuffer", () => {
  it("splits complete frames and keeps the partial remainder", () => {
    const { events, rest } = parseSseBuffer('data: {"delta":"a"}\n\ndata: {"delta":"b"}\n\ndata: {"del');
    expect(events).toEqual([{ delta: "a" }, { delta: "b" }]);
    expect(rest).toBe('data: {"del');
  });

  it("ignores a malformed frame without breaking", () => {
    const { events } = parseSseBuffer("data: not-json\n\ndata: {\"delta\":\"x\"}\n\n");
    expect(events).toEqual([{ delta: "x" }]);
  });
});

describe("streamAssistant", () => {
  const noAuth = { getToken: async () => undefined };

  it("accumulates deltas and delivers the final typed envelope", async () => {
    const frames = [
      'data: {"delta":"How "}\n\n',
      'data: {"delta":"to ship"}\n\n',
      `data: ${JSON.stringify({ done: true, assistant: envelope("How to ship") })}\n\n`,
    ];
    const fetchImpl = vi.fn().mockResolvedValue(sseResponse(frames));
    const deltas: string[] = [];
    let final: AssistantResponse | null = null;

    const text = await streamAssistant(
      "how do I ship?",
      { onDelta: (d) => deltas.push(d), onDone: (a) => (final = a) },
      { fetchImpl, getToken: noAuth.getToken },
    );

    expect(deltas).toEqual(["How ", "to ship"]);
    expect(text).toBe("How to ship");
    expect(final).not.toBeNull();
    expect(final!.result?.type).toBe("policy_answer");
    // POSTed to the streaming endpoint with the query
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("/api/v1/assistant/stream");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ query: "how do I ship?" });
  });

  it("reports a non-ok response via onError and never throws", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(sseResponse([], { status: 503 }));
    let err = "";
    const text = await streamAssistant("x", { onError: (m) => (err = m) }, {
      fetchImpl,
      getToken: noAuth.getToken,
    });
    expect(text).toBe("");
    expect(err).toContain("503");
  });

  it("reports a transport failure via onError", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    let err = "";
    await streamAssistant("x", { onError: (m) => (err = m) }, {
      fetchImpl,
      getToken: noAuth.getToken,
    });
    expect(err).toBe("network down");
  });
});
