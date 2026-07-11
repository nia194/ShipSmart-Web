/**
 * The typed grid action bus (Product Roadmap §6/§12).
 *
 * The assistant drives the result grid through TYPED, allowlisted actions — sort,
 * filter, and suggestion chips — never through prose the client has to interpret.
 * This is the pure reducer the grid applies; it owns no rendering, so it is fully
 * testable and the grid component stays a thin consumer.
 */
import type { GridAction, GridFilter, SortBy } from "@/lib/typed-outputs";

export interface GridViewState {
  sortBy: SortBy;
  filter: GridFilter;
}

export const emptyGridView = (): GridViewState => ({
  sortBy: "best_value",
  filter: { carrier_not: [] },
});

/** Apply one typed action to the grid view (pure). Unknown actions are ignored. */
export function applyGridAction(state: GridViewState, action: GridAction): GridViewState {
  switch (action.type) {
    case "sort_grid":
      return { ...state, sortBy: action.by };
    case "filter_grid":
      return { ...state, filter: { ...action.grid_filter } };
    case "suggest":
      return state; // suggestions are rendered as chips, they don't mutate the grid
    default:
      return state;
  }
}

/** Fold a batch of assistant actions onto the current grid view. */
export function applyGridActions(state: GridViewState, actions: GridAction[]): GridViewState {
  return actions.reduce(applyGridAction, state);
}

/** Collect the deterministic suggestion chips the assistant proposed. */
export function suggestionChips(actions: GridAction[]): string[] {
  return actions.flatMap((a) => (a.type === "suggest" ? a.chips : []));
}
