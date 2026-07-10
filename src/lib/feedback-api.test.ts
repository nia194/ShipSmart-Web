import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FEEDBACK_MAX_COMMENT_LENGTH,
  sendFeedback,
} from "@/lib/feedback-api";
import { http } from "@/lib/http";

vi.mock("@/lib/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http")>();
  return { ...actual, http: vi.fn() };
});

const httpMock = vi.mocked(http);

beforeEach(() => {
  httpMock.mockReset();
});

describe("sendFeedback", () => {
  it("POSTs the payload to the feedback endpoint and resolves true on 'recorded'", async () => {
    httpMock.mockResolvedValueOnce({ status: "recorded" });

    const ok = await sendFeedback({
      rating: "down",
      session_id: "sess-1",
      message_id: "msg-9",
      category: "wrong_answer",
      comment: "quoted the wrong price",
    });

    expect(ok).toBe(true);
    const [url, init] = httpMock.mock.calls[0];
    expect(url).toContain("/api/v1/feedback");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      rating: "down",
      session_id: "sess-1",
      message_id: "msg-9",
      category: "wrong_answer",
      comment: "quoted the wrong price",
    });
  });

  it("fills optional fields with additive-safe defaults", async () => {
    httpMock.mockResolvedValueOnce({ status: "recorded" });
    await sendFeedback({ rating: "up" });
    expect(JSON.parse(httpMock.mock.calls[0][1]?.body as string)).toEqual({
      rating: "up",
      session_id: null,
      message_id: "",
      category: "",
      comment: "",
    });
  });

  it("clips the comment to the server-side cap instead of 422ing", async () => {
    httpMock.mockResolvedValueOnce({ status: "recorded" });
    await sendFeedback({ rating: "up", comment: "x".repeat(FEEDBACK_MAX_COMMENT_LENGTH + 50) });
    const body = JSON.parse(httpMock.mock.calls[0][1]?.body as string);
    expect(body.comment).toHaveLength(FEEDBACK_MAX_COMMENT_LENGTH);
  });

  it("never throws — resolves false when the backend is down", async () => {
    httpMock.mockRejectedValueOnce(new Error("503"));
    await expect(sendFeedback({ rating: "up" })).resolves.toBe(false);
  });
});
