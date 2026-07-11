import { describe, expect, it } from "vitest";

import {
  applyGridAction,
  applyGridActions,
  emptyGridView,
  suggestionChips,
} from "@/lib/grid-actions";
import type { GridAction } from "@/lib/typed-outputs";

describe("grid action bus", () => {
  it("sorts the grid via a typed action", () => {
    const s = applyGridAction(emptyGridView(), { type: "sort_grid", by: "cheapest" });
    expect(s.sortBy).toBe("cheapest");
  });

  it("filters the grid via a typed filter", () => {
    const s = applyGridAction(emptyGridView(), {
      type: "filter_grid",
      grid_filter: { price_under: 30, carrier_not: ["USPS"] },
    });
    expect(s.filter.price_under).toBe(30);
    expect(s.filter.carrier_not).toEqual(["USPS"]);
  });

  it("folds a batch of actions in order", () => {
    const actions: GridAction[] = [
      { type: "sort_grid", by: "fastest" },
      { type: "filter_grid", grid_filter: { price_under: 50, carrier_not: [] } },
      { type: "suggest", chips: ["Compare fastest"] },
    ];
    const s = applyGridActions(emptyGridView(), actions);
    expect(s.sortBy).toBe("fastest");
    expect(s.filter.price_under).toBe(50);
  });

  it("suggestions are chips, not grid mutations", () => {
    const before = emptyGridView();
    const after = applyGridAction(before, { type: "suggest", chips: ["Under $30"] });
    expect(after).toEqual(before);
    expect(
      suggestionChips([
        { type: "suggest", chips: ["Under $30", "Compare fastest"] },
        { type: "sort_grid", by: "cheapest" },
      ]),
    ).toEqual(["Under $30", "Compare fastest"]);
  });
});
