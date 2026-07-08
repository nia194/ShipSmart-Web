import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ConciergePanel from "@/components/concierge/ConciergePanel";
import * as conciergeApi from "@/lib/concierge-api";
import type { ConciergeResponse } from "@/lib/concierge-api";
import { ShipmentDraftProvider, useShipmentDraft } from "@/state/ShipmentDraftContext";

function DraftProbe() {
  const { draft } = useShipmentDraft();
  return (
    <div>
      <span data-testid="origin">{draft.origin?.value ?? ""}</span>
      <span data-testid="destination">{draft.destination?.value ?? ""}</span>
    </div>
  );
}

function Seed() {
  const { setField } = useShipmentDraft();
  return (
    <button type="button" onClick={() => setField("origin", "Atlanta, GA", "form")}>
      seed-origin
    </button>
  );
}

function renderPanel() {
  return render(
    <ShipmentDraftProvider>
      <ConciergePanel />
      <Seed />
      <DraftProbe />
    </ShipmentDraftProvider>,
  );
}

const reply = (slots: Record<string, unknown>): ConciergeResponse => ({
  reply: "ok",
  state: { slots, intent: "quote", status: "gathering", pending_clarification: null, turns: 1 },
  session_id: null,
  clarification: null,
  dispatched_to: null,
  sources: [],
  decisions: [],
  provider: "echo",
});

async function send(text: string) {
  fireEvent.change(screen.getByLabelText("Message the concierge"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
}

describe("ConciergePanel", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("sends a message and patches the form with extracted entities (back-channel)", async () => {
    vi.spyOn(conciergeApi, "postConciergeChat").mockResolvedValue(
      reply({ origin: "Atlanta, GA", destination: "Seattle, WA" }),
    );
    renderPanel();
    await send("ship from Atlanta to Seattle");

    await waitFor(() => expect(screen.getByTestId("origin").textContent).toBe("Atlanta, GA"));
    expect(screen.getByTestId("destination").textContent).toBe("Seattle, WA");
  });

  it("surfaces a chat-vs-form conflict instead of overwriting, then resolves on choice", async () => {
    vi.spyOn(conciergeApi, "postConciergeChat").mockResolvedValue(reply({ origin: "Boston, MA" }));
    renderPanel();

    fireEvent.click(screen.getByText("seed-origin")); // form sets origin = Atlanta, GA
    await send("actually make it Boston");

    // conflict surfaced; form value NOT overwritten
    expect(await screen.findByText(/Which should I use/i)).toBeTruthy();
    expect(screen.getByTestId("origin").textContent).toBe("Atlanta, GA");

    fireEvent.click(screen.getByRole("button", { name: /Use Boston, MA/i }));
    await waitFor(() => expect(screen.getByTestId("origin").textContent).toBe("Boston, MA"));
  });

  it("recalls a prior conversation from the server on mount (reload)", async () => {
    localStorage.setItem("ss_concierge_session", "sess-123");
    vi.spyOn(conciergeApi, "getConciergeHistory").mockResolvedValue({
      session_id: "sess-123",
      state: {
        slots: { origin: "Atlanta, GA", destination: "Seattle, WA" },
        intent: "quote",
        status: "answered",
        pending_clarification: null,
        turns: 2,
      },
      messages: [
        { role: "user", content: "ship Atlanta to Seattle", created_at: "" },
        { role: "assistant", content: "Got it — from Atlanta, to Seattle.", created_at: "" },
      ],
    });
    renderPanel();

    // transcript replayed and the shared draft hydrated from the persisted state
    expect(await screen.findByText("ship Atlanta to Seattle")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("origin").textContent).toBe("Atlanta, GA"));
  });

  it("offers reply on a turn and shows (then cancels) the replying-to preview", async () => {
    vi.spyOn(conciergeApi, "postConciergeChat").mockResolvedValue(reply({}));
    renderPanel();
    await send("ship from Atlanta to Seattle");

    fireEvent.click(await screen.findByRole("button", { name: "↩ Reply" }));
    expect(await screen.findByText(/Replying to advisor/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /cancel reply/i }));
    await waitFor(() => expect(screen.queryByText(/Replying to advisor/i)).toBeNull());
  });
});
