import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ShipmentDraftProvider, useShipmentDraft } from "@/state/ShipmentDraftContext";
import { useShipmentDraftFormSync } from "@/state/useShipmentDraftFormSync";

/** A tiny stand-in for the homepage form: local field state + the sync hook. */
function Harness() {
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [weight, setWeight] = useState("");

  useShipmentDraftFormSync({
    origin,
    setOrigin,
    destination: dest,
    setDestination: setDest,
    dropDate: undefined,
    setDropDate: () => {},
    deliveryDate: undefined,
    setDeliveryDate: () => {},
    weightLbs: weight,
    setWeightLbs: setWeight,
  });

  const { draft, applyPatch, conflicts } = useShipmentDraft();
  return (
    <div>
      <span data-testid="form-origin">{origin}</span>
      <span data-testid="form-weight">{weight}</span>
      <span data-testid="draft-dest">{(draft.destination?.value as string) ?? ""}</span>
      <span data-testid="conflict-count">{conflicts.length}</span>
      <button type="button" onClick={() => setOrigin("Boston, MA")}>
        type-origin
      </button>
      <button type="button" onClick={() => setDest("Seattle, WA")}>
        type-dest
      </button>
      <button type="button" onClick={() => applyPatch({ origin: "Atlanta, GA", weightLbs: 12 }, "chat")}>
        chat-fill
      </button>
      <button type="button" onClick={() => applyPatch({ origin: "Atlanta, GA" }, "chat")}>
        chat-origin
      </button>
    </div>
  );
}

const renderHarness = () =>
  render(
    <ShipmentDraftProvider>
      <Harness />
    </ShipmentDraftProvider>,
  );

describe("useShipmentDraftFormSync", () => {
  it("pre-fills the form from chat-extracted draft slots (draft → form)", async () => {
    renderHarness();
    fireEvent.click(screen.getByText("chat-fill"));
    await waitFor(() => {
      expect(screen.getByTestId("form-origin").textContent).toBe("Atlanta, GA");
      expect(screen.getByTestId("form-weight").textContent).toBe("12");
    });
  });

  it("writes manual form edits into the shared draft (form → draft)", async () => {
    renderHarness();
    fireEvent.click(screen.getByText("type-dest"));
    await waitFor(() =>
      expect(screen.getByTestId("draft-dest").textContent).toBe("Seattle, WA"),
    );
  });

  it("keeps a manually-typed value over a conflicting chat suggestion (form wins)", async () => {
    renderHarness();
    fireEvent.click(screen.getByText("type-origin")); // user types Boston, MA
    await waitFor(() => expect(screen.getByTestId("form-origin").textContent).toBe("Boston, MA"));

    fireEvent.click(screen.getByText("chat-origin")); // chat suggests a different Atlanta, GA
    await waitFor(() =>
      expect(Number(screen.getByTestId("conflict-count").textContent)).toBeGreaterThan(0),
    );
    // the typed value is preserved (not silently overwritten); the conflict is recorded
    expect(screen.getByTestId("form-origin").textContent).toBe("Boston, MA");
  });
});
