import { describe, expect, it } from "vitest";

import {
  actionRequiresConfirmation,
  patchRequiresConfirmation,
  responseNeedsConfirmation,
} from "@/lib/ai-trust";
import type { Action, AssistantResponse, FieldPatch } from "@/lib/typed-outputs";

function action(over: Partial<Action> = {}): Action {
  return {
    name: "get_quote",
    risk_tier: "read",
    params: {},
    requires_confirmation: false,
    ...over,
  };
}

function patch(over: Partial<FieldPatch> = {}): FieldPatch {
  return {
    field_path: "shipment.notes",
    new_value: "x",
    confidence: 0.9,
    reason: "user asked",
    source: "user_text",
    requires_confirmation: false,
    ...over,
  };
}

function response(over: Partial<AssistantResponse> = {}): AssistantResponse {
  return {
    type: "answer",
    message: "ok",
    sources: [],
    actions: [],
    form_patch: null,
    risk_tier: "read",
    requires_confirmation: false,
    ...over,
  };
}

describe("actionRequiresConfirmation", () => {
  it("gates write/high/quote-tier actions even if the model marked them safe", () => {
    expect(actionRequiresConfirmation(action({ risk_tier: "write" }))).toBe(true);
    expect(actionRequiresConfirmation(action({ risk_tier: "high" }))).toBe(true);
    expect(actionRequiresConfirmation(action({ risk_tier: "quote" }))).toBe(true);
  });

  it("does not gate a plain read action", () => {
    expect(actionRequiresConfirmation(action({ risk_tier: "read" }))).toBe(false);
  });

  it("honours an explicit requires_confirmation flag", () => {
    expect(actionRequiresConfirmation(action({ risk_tier: "read", requires_confirmation: true }))).toBe(
      true,
    );
  });
});

describe("patchRequiresConfirmation", () => {
  it("gates an AI-set price/total field that did not come from the user", () => {
    expect(patchRequiresConfirmation(patch({ field_path: "quote.total", source: "quote_data" }))).toBe(
      true,
    );
    expect(
      patchRequiresConfirmation(patch({ field_path: "shipment.price", source: "tool_result" })),
    ).toBe(true);
  });

  it("allows a user-typed value into a non-authoritative field without a gate", () => {
    expect(patchRequiresConfirmation(patch({ field_path: "shipment.notes", source: "user_text" }))).toBe(
      false,
    );
  });

  it("does not silently trust a price just because the user mentioned one", () => {
    // Authoritative fields still defer to the server quote; only user_text is exempt,
    // and even then the field must be non-authoritative.
    expect(patchRequiresConfirmation(patch({ field_path: "quote.total", source: "user_text" }))).toBe(
      false,
    );
    expect(patchRequiresConfirmation(patch({ field_path: "quote.total", requires_confirmation: true }))).toBe(
      true,
    );
  });
});

describe("responseNeedsConfirmation", () => {
  it("passes a plain read answer with nothing to apply", () => {
    expect(responseNeedsConfirmation(response())).toBe(false);
  });

  it("gates a response carrying a write action", () => {
    expect(responseNeedsConfirmation(response({ actions: [action({ risk_tier: "write" })] }))).toBe(
      true,
    );
  });

  it("gates a response whose form patch sets an authoritative field", () => {
    const fp = { patches: [patch({ field_path: "quote.total", source: "quote_data" })] };
    expect(responseNeedsConfirmation(response({ type: "form_patch", form_patch: fp }))).toBe(true);
  });

  it("gates a quote-tier response outright", () => {
    expect(responseNeedsConfirmation(response({ risk_tier: "quote" }))).toBe(true);
  });
});
