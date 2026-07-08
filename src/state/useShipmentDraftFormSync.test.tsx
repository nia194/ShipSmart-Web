import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  ShipmentDraftProvider,
  useShipmentDraft,
} from "@/state/ShipmentDraftContext";
import { useShipmentDraftFormSync } from "@/state/useShipmentDraftFormSync";

function HarnessInner() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [dropDate, setDropDate] = useState<Date | undefined>();
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>();
  const [weightLbs, setWeightLbs] = useState("");

  const { draft, applyPatch, conflicts } = useShipmentDraft();

  useShipmentDraftFormSync({
    origin,
    setOrigin,
    destination,
    setDestination,
    dropDate,
    setDropDate,
    deliveryDate,
    setDeliveryDate,
    weightLbs,
    setWeightLbs,
  });

  return (
    <div>
      <span data-testid="form-origin">{origin}</span>
      <span data-testid="form-dest">{destination}</span>
      <span data-testid="form-weight">{weightLbs}</span>
      <span data-testid="form-drop-date">
        {dropDate ? dropDate.toISOString().slice(0, 10) : ""}
      </span>
      <span data-testid="form-delivery-date">
        {deliveryDate ? deliveryDate.toISOString().slice(0, 10) : ""}
      </span>

      <span data-testid="draft-origin">{String(draft.origin?.value ?? "")}</span>
      <span data-testid="draft-dest">
        {String(draft.destination?.value ?? "")}
      </span>
      <span data-testid="conflict-count">{conflicts.length}</span>

      <button type="button" onClick={() => setOrigin("Atlanta, GA")}>
        type-origin
      </button>

      <button type="button" onClick={() => setDestination("Seattle, WA")}>
        type-dest
      </button>

      <button
        type="button"
        onClick={() =>
          applyPatch(
            {
              origin: "Atlanta, GA",
              destination: "Seattle, WA",
              weightLbs: "12",
              dropOffDate: "2026-07-10",
              deliveryDate: "2026-07-12",
            },
            "chat",
          )
        }
      >
        chat-fill
      </button>

      <button
        type="button"
        onClick={() =>
          applyPatch(
            {
              origin: "Atlanta, Georgia",
            },
            "chat",
          )
        }
      >
        chat-origin
      </button>
    </div>
  );
}

function renderHarness() {
  return render(
    <ShipmentDraftProvider>
      <HarnessInner />
    </ShipmentDraftProvider>,
  );
}

describe("useShipmentDraftFormSync", () => {
  it("pre-fills the form from chat-extracted draft slots", async () => {
    renderHarness();

    fireEvent.click(screen.getByText("chat-fill"));

    await waitFor(() => {
      expect(screen.getByTestId("form-origin").textContent).toBe("Atlanta, GA");
      expect(screen.getByTestId("form-dest").textContent).toBe("Seattle, WA");
      expect(screen.getByTestId("form-weight").textContent).toBe("12");
      expect(screen.getByTestId("form-drop-date").textContent).toBe(
        "2026-07-10",
      );
      expect(screen.getByTestId("form-delivery-date").textContent).toBe(
        "2026-07-12",
      );
    });
  });

  it("does not write manual form edits back into the shared draft", async () => {
    renderHarness();

    fireEvent.click(screen.getByText("type-dest"));

    await waitFor(() => {
      expect(screen.getByTestId("form-dest").textContent).toBe("Seattle, WA");
      expect(screen.getByTestId("draft-dest").textContent).toBe("");
    });
  });

  it("does not silently overwrite a manually typed form value with a chat suggestion", async () => {
    renderHarness();

    fireEvent.click(screen.getByText("type-origin"));

    await waitFor(() => {
      expect(screen.getByTestId("form-origin").textContent).toBe("Atlanta, GA");
    });

    fireEvent.click(screen.getByText("chat-origin"));

    await waitFor(() => {
      expect(screen.getByTestId("form-origin").textContent).toBe("Atlanta, GA");
      expect(screen.getByTestId("draft-origin").textContent).toBe(
        "Atlanta, Georgia",
      );
    });
  });
});