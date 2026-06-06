import { describe, expect, it } from "vitest";

import {
  ADVISOR_MAX_QUESTION_LENGTH,
  friendlyAdvisorError,
  shipmentToContext,
  type ShipmentSummary,
} from "@/lib/advisor-api";
import { HttpError } from "@/lib/http";

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
