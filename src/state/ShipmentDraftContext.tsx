/**
 * The shared ShipmentDraft store — React Context + useReducer (no new dependency).
 *
 * All mutation goes through the pure reducer (the merge rules live in
 * `shipmentDraft.ts`), so the form and the chat agree deterministically. The
 * provider wraps the HomePage route so both surfaces read/write one source of truth.
 */
import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";

import type { PackageItem } from "@/lib/shipping-data";
import {
  applyPatchToDraft,
  emptyDraft,
  mergeField,
  type FieldSource,
  type PendingConflict,
  type ScalarField,
  type ShipmentDraft,
} from "@/state/shipmentDraft";

interface State {
  draft: ShipmentDraft;
  conflicts: PendingConflict[];
}

type Action =
  | { type: "SET_FIELD"; field: ScalarField; value: unknown; source: FieldSource }
  | { type: "SET_ITEMS"; items: PackageItem[] }
  | { type: "APPLY_PATCH"; patch: Partial<Record<ScalarField, unknown>>; source: FieldSource }
  | { type: "RESOLVE_CONFLICT"; field: ScalarField; choice: "current" | "incoming" }
  | { type: "RESET" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_FIELD": {
      const { draft, conflict } = mergeField(state.draft, action.field, action.value, action.source);
      const conflicts = conflict
        ? [...state.conflicts.filter((c) => c.field !== conflict.field), conflict]
        : state.conflicts;
      return { draft, conflicts };
    }
    case "SET_ITEMS":
      return { ...state, draft: { ...state.draft, items: action.items } };
    case "APPLY_PATCH": {
      const { draft, conflicts } = applyPatchToDraft(state.draft, action.patch, action.source);
      const affected = new Set(conflicts.map((c) => c.field));
      const kept = state.conflicts.filter((c) => !affected.has(c.field));
      return { draft, conflicts: [...kept, ...conflicts] };
    }
    case "RESOLVE_CONFLICT": {
      const conflict = state.conflicts.find((c) => c.field === action.field);
      const conflicts = state.conflicts.filter((c) => c.field !== action.field);
      if (!conflict) return { ...state, conflicts };
      if (action.choice === "incoming") {
        const draft = {
          ...state.draft,
          [action.field]: { value: conflict.incoming, source: "chat" as const, at: Date.now() },
        };
        return { draft, conflicts };
      }
      return { ...state, conflicts }; // keep the form value; just clear the conflict
    }
    case "RESET":
      return { draft: emptyDraft(), conflicts: [] };
    default:
      return state;
  }
}

export interface ShipmentDraftApi {
  draft: ShipmentDraft;
  items: PackageItem[];
  conflicts: PendingConflict[];
  setField: (field: ScalarField, value: unknown, source?: FieldSource) => void;
  setItems: (items: PackageItem[]) => void;
  applyPatch: (patch: Partial<Record<ScalarField, unknown>>, source?: FieldSource) => void;
  resolveConflict: (field: ScalarField, choice: "current" | "incoming") => void;
  reset: () => void;
}

const ShipmentDraftCtx = createContext<ShipmentDraftApi | null>(null);

export function ShipmentDraftProvider({
  children,
  initialItems = [],
}: {
  children: ReactNode;
  initialItems?: PackageItem[];
}) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    draft: { ...emptyDraft(), items: initialItems },
    conflicts: [],
  }));

  // dispatch is stable → these callbacks are stable, so consumer effects that
  // depend on them won't loop.
  const setField = useCallback(
    (field: ScalarField, value: unknown, source: FieldSource = "form") =>
      dispatch({ type: "SET_FIELD", field, value, source }),
    [],
  );
  const setItems = useCallback((items: PackageItem[]) => dispatch({ type: "SET_ITEMS", items }), []);
  const applyPatch = useCallback(
    (patch: Partial<Record<ScalarField, unknown>>, source: FieldSource = "chat") =>
      dispatch({ type: "APPLY_PATCH", patch, source }),
    [],
  );
  const resolveConflict = useCallback(
    (field: ScalarField, choice: "current" | "incoming") =>
      dispatch({ type: "RESOLVE_CONFLICT", field, choice }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  const api = useMemo<ShipmentDraftApi>(
    () => ({
      draft: state.draft,
      items: state.draft.items,
      conflicts: state.conflicts,
      setField,
      setItems,
      applyPatch,
      resolveConflict,
      reset,
    }),
    [state, setField, setItems, applyPatch, resolveConflict, reset],
  );

  return <ShipmentDraftCtx.Provider value={api}>{children}</ShipmentDraftCtx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useShipmentDraft(): ShipmentDraftApi {
  const ctx = useContext(ShipmentDraftCtx);
  if (!ctx) throw new Error("useShipmentDraft must be used within a ShipmentDraftProvider");
  return ctx;
}
