import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssistantResultView } from "@/components/assistant/AssistantResult";
import type { AssistantResponse } from "@/lib/typed-outputs";

function base(over: Partial<AssistantResponse> = {}): AssistantResponse {
  return {
    type: "answer",
    message: "",
    sources: [],
    actions: [],
    risk_tier: "read",
    requires_confirmation: false,
    schema_version: "1",
    apply_policy: "none",
    confidence: 0.7,
    missing_fields: [],
    tool_calls: [],
    ...over,
  };
}

describe("AssistantResultView", () => {
  it("renders a shipping_option card from typed data (never parsed prose)", () => {
    render(
      <AssistantResultView
        response={base({
          message: "Cheapest option:",
          result: {
            type: "shipping_option",
            label: "Cheapest",
            quote_id: "Q-100",
            carrier: "FedEx",
            service_name: "Ground",
            price_usd: 42.5,
            transit_days: 3,
            reason: "lowest total",
            badges: ["tracked"],
          },
        })}
      />,
    );
    expect(screen.getByTestId("result-shipping-option")).toBeInTheDocument();
    expect(screen.getByText("$42.50")).toBeInTheDocument();
    expect(screen.getByText(/FedEx Ground/)).toBeInTheDocument();
    expect(screen.getByText("Cheapest")).toBeInTheDocument();
    expect(screen.getByText("tracked")).toBeInTheDocument();
  });

  it("renders a missing_info card with the next question", () => {
    render(
      <AssistantResultView
        response={base({
          type: "ask_followup",
          result: {
            type: "missing_info",
            missing_fields: ["destination"],
            next_question: "What's the destination ZIP?",
          },
        })}
      />,
    );
    expect(screen.getByTestId("result-missing-info")).toBeInTheDocument();
    expect(screen.getByText("What's the destination ZIP?")).toBeInTheDocument();
    expect(screen.getByText(/Still need: destination/)).toBeInTheDocument();
  });

  it("renders a policy_answer card with sources", () => {
    render(
      <AssistantResultView
        response={base({
          result: {
            type: "policy_answer",
            answer: "Lithium batteries are dangerous goods.",
            sources: [{ source: "compliance/lithium.md" }],
          },
        })}
      />,
    );
    expect(screen.getByTestId("result-policy-answer")).toBeInTheDocument();
    expect(screen.getByText(/compliance\/lithium.md/)).toBeInTheDocument();
  });

  it("renders tool-call chips and a message with no result", () => {
    render(
      <AssistantResultView
        response={base({
          message: "Working on it.",
          tool_calls: [{ name: "get_quote_preview", args_shape: [], status: "ok", latency_ms: 5 }],
        })}
      />,
    );
    expect(screen.getByText("Working on it.")).toBeInTheDocument();
    expect(screen.getByTestId("tool-chips")).toHaveTextContent("get_quote_preview");
    expect(screen.queryByTestId("assistant-result")?.querySelector("[data-testid^='result-']")).toBeNull();
  });
});
