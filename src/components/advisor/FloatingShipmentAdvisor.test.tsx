import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FloatingShipmentAdvisor from "@/components/advisor/FloatingShipmentAdvisor";
import type { CompareOption } from "@/components/shipping/compare.types";
import * as advisorApi from "@/lib/advisor-api";

vi.mock("@/lib/advisor-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/advisor-api")>();
  return { ...actual, postShippingAdvice: vi.fn() };
});

// jsdom doesn't implement scrollIntoView (the chat auto-scrolls on new messages).
Element.prototype.scrollIntoView = vi.fn();

const OPTIONS: CompareOption[] = [
  {
    id: "1", carrier: "FedEx", service_name: "Express", carrier_type: "private",
    price_usd: 40, arrival_date: "2026-07-04", arrival_label: "Fri", transit_days: 2,
    guaranteed: true,
  },
  {
    id: "2", carrier: "LuggageToShip", service_name: "Economy", carrier_type: "public",
    price_usd: 18, arrival_date: "2026-07-09", arrival_label: "Wed", transit_days: 6,
    guaranteed: false,
  },
];

function renderAdvisor() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <FloatingShipmentAdvisor
        open
        onOpenChange={() => {}}
        context={{ origin_zip: "10001", destination_zip: "90210", weight_lbs: 5 }}
        options={OPTIONS}
        selectedPriority="price"
      />
    </QueryClientProvider>,
  );
}

// Questions chosen to MISS the deterministic local-answer path so they hit the backend.
async function ask(text: string) {
  const textarea = await screen.findByPlaceholderText(/Ask about these shipping options/i);
  fireEvent.change(textarea, { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /send message/i }));
}

describe("FloatingShipmentAdvisor reply-to", () => {
  beforeEach(() => {
    vi.mocked(advisorApi.postShippingAdvice).mockReset().mockResolvedValue({
      answer: "Mocked advice", reasoning_summary: "", tools_used: [], sources: [],
      context_used: false, decision_path: null,
    });
  });

  it("replies to an assistant message and sends reply_to to the backend", async () => {
    renderAdvisor();
    await ask("Is insurance included for these?");
    expect(await screen.findByText(/Mocked advice/)).toBeTruthy();

    // Reply to the assistant message (rendered last → last Reply button).
    const replyButtons = screen.getAllByRole("button", { name: "↩ Reply" });
    fireEvent.click(replyButtons[replyButtons.length - 1]);
    expect(await screen.findByText(/Replying to advisor/i)).toBeTruthy();

    await ask("What about fragile items?");
    await waitFor(() => {
      const calls = vi.mocked(advisorApi.postShippingAdvice).mock.calls;
      expect(calls[calls.length - 1][2]?.reply_to).toEqual({
        role: "assistant",
        text: "Mocked advice",
      });
    });
  });

  it("cancels a reply before sending", async () => {
    renderAdvisor();
    await ask("Is insurance included for these?");
    expect(await screen.findByText(/Mocked advice/)).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "↩ Reply" })[0]);
    expect(await screen.findByText(/Replying to/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /cancel reply/i }));
    await waitFor(() => expect(screen.queryByText(/Replying to/i)).toBeNull());
  });
});
