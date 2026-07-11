import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShipmentDraftProvider, useShipmentDraft } from "@/state/ShipmentDraftContext";

function Probe() {
  const { draft, applyPatch, undoLastPatch, canUndo, setField } = useShipmentDraft();
  return (
    <div>
      <span data-testid="origin">{draft.origin?.value ?? ""}</span>
      <span data-testid="can-undo">{canUndo ? "yes" : "no"}</span>
      <button type="button" onClick={() => applyPatch({ origin: "Atlanta, GA" }, "chat")}>
        patch
      </button>
      <button type="button" onClick={() => undoLastPatch()}>
        undo
      </button>
      <button type="button" onClick={() => setField("origin", "Boston, MA", "form")}>
        manual
      </button>
    </div>
  );
}

function setup() {
  return render(
    <ShipmentDraftProvider>
      <Probe />
    </ShipmentDraftProvider>,
  );
}

describe("ShipmentDraft undo (Product Roadmap §6)", () => {
  it("restores the pre-patch draft and clears canUndo", () => {
    setup();
    expect(screen.getByTestId("can-undo").textContent).toBe("no");

    fireEvent.click(screen.getByText("patch"));
    expect(screen.getByTestId("origin").textContent).toBe("Atlanta, GA");
    expect(screen.getByTestId("can-undo").textContent).toBe("yes");

    fireEvent.click(screen.getByText("undo"));
    expect(screen.getByTestId("origin").textContent).toBe("");
    expect(screen.getByTestId("can-undo").textContent).toBe("no");
  });

  it("undo is a no-op when there is nothing to undo", () => {
    setup();
    fireEvent.click(screen.getByText("undo")); // nothing patched yet
    expect(screen.getByTestId("origin").textContent).toBe("");
    expect(screen.getByTestId("can-undo").textContent).toBe("no");
  });

  it("a manual edit invalidates the assistant undo", () => {
    setup();
    fireEvent.click(screen.getByText("patch"));
    expect(screen.getByTestId("can-undo").textContent).toBe("yes");

    fireEvent.click(screen.getByText("manual")); // direct user edit
    expect(screen.getByTestId("can-undo").textContent).toBe("no");
    // undo now does nothing — it never reverses a manual edit
    fireEvent.click(screen.getByText("undo"));
    expect(screen.getByTestId("origin").textContent).toBe("Boston, MA");
  });
});
