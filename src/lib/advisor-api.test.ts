import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADVISOR_MAX_QUESTION_LENGTH,
  friendlyAdvisorError,
  postShippingAdvice,
  shipmentToContext,
  type ShipmentSummary,
} from "@/lib/advisor-api";
import { http, HttpError } from "@/lib/http";

vi.mock("@/lib/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http")>();
  return { ...actual, http: vi.fn() };
});

describe("friendlyAdvisorError", () => {
  it.each([
    [429, "busy"],
    [502, "unavailable"],
    [503, "unavailable"],
    [504, "timed out"],
    [422, "can't help"],
    [400, "shorten"],
    [401, "sign in"],
    [403, "sign in"],
  ])("maps HTTP %i to friendly, non-technical copy", (status, needle) => {
    const friendly = friendlyAdvisorError(new HttpError(status, { status }));
    const blob = `${friendly.title} ${friendly.message}`.toLowerCase();
    expect(blob).toContain(needle);
  });

  it("falls back to a generic message for non-HttpError and unknown status", () => {
    expect(friendlyAdvisorError(new Error("boom")).title).toBe("Something went wrong");
    expect(friendlyAdvisorError(new HttpError(418, { status: 418 })).title).toBe(
      "Something went wrong",
    );
  });
});

describe("shipmentToContext", () => {
  it("maps a persisted shipment to advisor context, dropping nulls", () => {
    const shipment: ShipmentSummary = {
      id: "1",
      origin: "10001",
      destination: "90210",
      dropOffDate: "2026-06-01",
      expectedDeliveryDate: null,
      totalWeight: 5,
      totalItems: 2,
      status: "DRAFT",
      version: 0,
      createdAt: "2026-06-01T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z",
    };
    expect(shipmentToContext(shipment)).toEqual({
      origin_zip: "10001",
      destination_zip: "90210",
      weight_lbs: 5,
      drop_off_date: "2026-06-01",
      expected_delivery_date: undefined, // null collapses to undefined, not forwarded
    });
  });
});

describe("ADVISOR_MAX_QUESTION_LENGTH", () => {
  it("mirrors the server-side advisor input cap", () => {
    expect(ADVISOR_MAX_QUESTION_LENGTH).toBe(2000);
  });
});

describe("postShippingAdvice reply context", () => {
  beforeEach(() => {
    vi.mocked(http).mockReset().mockResolvedValue({} as never);
  });

  const lastBody = () =>
    JSON.parse((vi.mocked(http).mock.calls.at(-1)?.[1] as { body: string }).body);

  it("includes reply_to + recent_history when replying to a message", async () => {
    await postShippingAdvice(
      "why not the cheaper one?",
      { origin_zip: "10001" },
      {
        reply_to: { role: "assistant", text: "FedEx fastest, LuggageToShip cheapest" },
        recent_history: [{ role: "user", text: "options?" }],
      },
    );
    const body = lastBody();
    expect(body.reply_to).toEqual({
      role: "assistant",
      text: "FedEx fastest, LuggageToShip cheapest",
    });
    expect(body.recent_history).toEqual([{ role: "user", text: "options?" }]);
  });

  it("sends null reply fields for a normal (non-reply) question — back-compat", async () => {
    await postShippingAdvice("what carriers are available?", {});
    const body = lastBody();
    expect(body.reply_to).toBeNull();
    expect(body.recent_history).toBeNull();
  });
});
