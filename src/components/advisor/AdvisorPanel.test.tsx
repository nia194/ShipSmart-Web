import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AdvisorPanel from "./AdvisorPanel";
import { HttpError } from "@/lib/http";
import * as advisorApi from "@/lib/advisor-api";

// Mock the network client; keep friendlyAdvisorError + constants real.
vi.mock("@/lib/advisor-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/advisor-api")>();
  return {
    ...actual,
    postShippingAdvice: vi.fn(),
    postTrackingAdvice: vi.fn(),
    fetchShipment: vi.fn(),
  };
});

const postShipping = vi.mocked(advisorApi.postShippingAdvice);

function renderPanel() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <AdvisorPanel context={{ origin_zip: "10001", destination_zip: "90210", weight_lbs: 5 }} />
    </QueryClientProvider>,
  );
}

function open() {
  fireEvent.click(screen.getByRole("button", { name: /ask about this shipment/i }));
}

function ask(question: string) {
  fireEvent.change(screen.getByLabelText("Ask about this shipment"), {
    target: { value: question },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdvisorPanel", () => {
  it("renders an AI-generated answer with a provenance badge and citation chip", async () => {
    postShipping.mockResolvedValue({
      answer: "UPS Ground is the cheapest fit.",
      reasoning_summary: "",
      tools_used: [],
      sources: [{ source: "carriers/ups.md", chunk_index: 0, score: 0.91 }],
      context_used: true,
      decision_path: { mode: "normal", retrieval: "dense", answer: "llm", provider: "openai", tags: [] },
    });

    renderPanel();
    open();
    ask("Which option is cheapest?");

    expect(await screen.findByText("UPS Ground is the cheapest fit.")).toBeTruthy();
    expect(screen.getByText("AI-generated")).toBeTruthy();
    expect(screen.getByText(/carriers\/ups\.md/)).toBeTruthy();
    expect(postShipping).toHaveBeenCalledWith(
      "Which option is cheapest?",
      expect.objectContaining({ origin_zip: "10001", destination_zip: "90210", weight_lbs: 5 }),
    );
  });

  it("labels a deterministic answer as Rule-based", async () => {
    postShipping.mockResolvedValue({
      answer: "Cheapest: Ground.",
      reasoning_summary: "",
      tools_used: [],
      sources: [],
      context_used: false,
      decision_path: { mode: "normal", retrieval: "dense", answer: "rule", provider: "", tags: ["ranking:rule"] },
    });

    renderPanel();
    open();
    ask("What is cheapest?");

    expect(await screen.findByText("Cheapest: Ground.")).toBeTruthy();
    expect(screen.getByText("Rule-based")).toBeTruthy();
  });

  it("degrades gracefully on a rate-limit error without breaking the panel", async () => {
    postShipping.mockRejectedValue(new HttpError(429, { status: 429, title: "rate limit" }));

    renderPanel();
    open();
    ask("Anything?");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("busy");
    // Panel survives — input is still usable (transactional flows are unaffected).
    expect(screen.getByLabelText("Ask about this shipment")).toBeTruthy();
  });

  it("disables send for empty / too-short input (client validation)", () => {
    renderPanel();
    open();

    const send = screen.getByRole("button", { name: "Ask" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true); // empty

    fireEvent.change(screen.getByLabelText("Ask about this shipment"), { target: { value: "hi" } });
    expect(send.disabled).toBe(true); // below min length

    fireEvent.change(screen.getByLabelText("Ask about this shipment"), { target: { value: "help me ship" } });
    expect(send.disabled).toBe(false);
    expect(postShipping).not.toHaveBeenCalled();
  });
});
