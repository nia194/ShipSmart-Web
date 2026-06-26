import { describe, expect, it } from "vitest";

import type { ConciergeState } from "@/lib/concierge-api";
import {
  applyPatchToDraft,
  conciergeStateToPatch,
  draftToConciergeState,
  emptyDraft,
  mergeField,
  valuesEquivalent,
  type ShipmentDraft,
} from "@/state/shipmentDraft";

const draftWith = (over: Partial<ShipmentDraft> = {}): ShipmentDraft => ({ ...emptyDraft(), ...over });

describe("mergeField", () => {
  it("empty never overwrites non-empty", () => {
    const start = draftWith({ origin: { value: "Atlanta, GA", source: "form", at: 1 } });
    const { draft } = mergeField(start, "origin", "", "chat");
    expect(draft.origin?.value).toBe("Atlanta, GA");
  });

  it("a manual form edit always wins", () => {
    const start = draftWith({ origin: { value: "Atlanta, GA", source: "chat", at: 1 } });
    const { draft } = mergeField(start, "origin", "Boston, MA", "form");
    expect(draft.origin).toEqual({ value: "Boston, MA", source: "form", at: expect.any(Number) });
  });

  it("chat does not overwrite a conflicting form value — it records a conflict", () => {
    const start = draftWith({ origin: { value: "Atlanta, GA", source: "form", at: 1 } });
    const { draft, conflict } = mergeField(start, "origin", "Boston, MA", "chat");
    expect(draft.origin?.value).toBe("Atlanta, GA");
    expect(conflict).toEqual({ field: "origin", current: "Atlanta, GA", incoming: "Boston, MA" });
  });

  it("chat fills an empty field freely", () => {
    const { draft, conflict } = mergeField(emptyDraft(), "destination", "Seattle, WA", "chat");
    expect(draft.destination?.value).toBe("Seattle, WA");
    expect(conflict).toBeUndefined();
  });

  it("an equivalent restatement is a no-op (keeps source + timestamp)", () => {
    const start = draftWith({ origin: { value: "Atlanta, GA", source: "form", at: 7 } });
    const { draft, conflict } = mergeField(start, "origin", "atlanta", "chat");
    expect(draft.origin).toEqual({ value: "Atlanta, GA", source: "form", at: 7 });
    expect(conflict).toBeUndefined();
  });

  it("hydrated loses to an explicit user write", () => {
    const start = draftWith({ origin: { value: "Atlanta, GA", source: "form", at: 1 } });
    const { draft } = mergeField(start, "origin", "Denver, CO", "hydrated");
    expect(draft.origin?.value).toBe("Atlanta, GA");
  });
});

describe("valuesEquivalent", () => {
  it("treats Atlanta == Atlanta, GA but distinct cities differ", () => {
    expect(valuesEquivalent("Atlanta", "Atlanta, GA")).toBe(true);
    expect(valuesEquivalent("Boston, MA", "Seattle, WA")).toBe(false);
  });
});

describe("back-channel adapters", () => {
  it("conciergeStateToPatch emits only genuinely-changed fields", () => {
    const draft = draftWith({ origin: { value: "Atlanta, GA", source: "form", at: 1 } });
    const state: ConciergeState = {
      slots: { origin: "atlanta", destination: "Seattle, WA" },
      intent: "quote",
      status: "gathering",
      pending_clarification: null,
      turns: 1,
    };
    expect(conciergeStateToPatch(state, draft)).toEqual({ destination: "Seattle, WA" });
  });

  it("a chat patch fills empty fields but a form conflict is surfaced, not applied", () => {
    const draft = applyPatchToDraft(emptyDraft(), { origin: "Atlanta, GA" }, "form").draft;
    const state: ConciergeState = {
      slots: { origin: "Boston, MA", destination: "Seattle, WA" },
      intent: "quote",
      status: "gathering",
      pending_clarification: null,
      turns: 1,
    };
    const patch = conciergeStateToPatch(state, draft);
    const { draft: next, conflicts } = applyPatchToDraft(draft, patch, "chat");
    expect(next.destination?.value).toBe("Seattle, WA");
    expect(next.origin?.value).toBe("Atlanta, GA");
    expect(conflicts.map((c) => c.field)).toEqual(["origin"]);
  });

  it("draftToConciergeState maps fields + the primary item into slots", () => {
    const draft: ShipmentDraft = {
      ...emptyDraft(),
      origin: { value: "Atlanta, GA", source: "form", at: 1 },
      priority: { value: "speed", source: "form", at: 1 },
      items: [{ type: "boxes", qty: "1", weight: "12", l: "10", w: "8", h: "6", handling: "standard" }],
    };
    const state = draftToConciergeState(draft);
    expect(state.slots.origin).toBe("Atlanta, GA");
    expect(state.slots.weight_lbs).toBe(12);
    expect(state.slots.length_in).toBe(10);
    expect(state.slots.category).toBe("boxes");
    expect(state.slots.priority).toBe("speed");
  });
});
