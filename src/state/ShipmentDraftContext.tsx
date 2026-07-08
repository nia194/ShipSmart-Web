/**
 * Shared ShipmentDraft store for the homepage form + concierge chat.
 *
 * The form and chat both read/write one deterministic source of truth.
 * Merge/conflict rules live in shipmentDraft.ts.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

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

type DraftPatch = Partial<Record<ScalarField, unknown>>;

interface State {
  draft: ShipmentDraft;
  conflicts: PendingConflict[];
}

type Action =
  | {
      type: "SET_FIELD";
      field: ScalarField;
      value: unknown;
      source: FieldSource;
    }
  | {
      type: "SET_ITEMS";
      items: PackageItem[];
    }
  | {
      type: "APPLY_PATCH";
      patch: DraftPatch;
      source: FieldSource;
    }
  | {
      type: "RESOLVE_CONFLICT";
      field: ScalarField;
      choice: "current" | "incoming";
    }
  | {
      type: "RESET";
    };

function createInitialState(initialItems: PackageItem[] = []): State {
  return {
    draft: {
      ...emptyDraft(),
      items: initialItems,
    },
    conflicts: [],
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_FIELD": {
      const result = mergeField(
        state.draft,
        action.field,
        action.value,
        action.source,
      );

      const conflicts = state.conflicts.filter(
        (conflict) => conflict.field !== action.field,
      );

      if (result.conflict) {
        conflicts.push(result.conflict);
      }

      return {
        draft: result.draft,
        conflicts,
      };
    }

    case "SET_ITEMS": {
      return {
        ...state,
        draft: {
          ...state.draft,
          items: action.items,
        },
      };
    }

    case "APPLY_PATCH": {
      const result = applyPatchToDraft(
        state.draft,
        action.patch,
        action.source,
      );

      const touchedFields = new Set(
        Object.keys(action.patch) as ScalarField[],
      );

      const keptConflicts = state.conflicts.filter(
        (conflict) => !touchedFields.has(conflict.field),
      );

      return {
        draft: result.draft,
        conflicts: [...keptConflicts, ...result.conflicts],
      };
    }

    case "RESOLVE_CONFLICT": {
      const conflict = state.conflicts.find(
        (item) => item.field === action.field,
      );

      const conflicts = state.conflicts.filter(
        (item) => item.field !== action.field,
      );

      if (!conflict) {
        return {
          ...state,
          conflicts,
        };
      }

      if (action.choice === "current") {
        return {
          ...state,
          conflicts,
        };
      }

      return {
        draft: {
          ...state.draft,
          [action.field]: {
            value: conflict.incoming,
            source: "chat",
            at: Date.now(),
          },
        } as ShipmentDraft,
        conflicts,
      };
    }

    case "RESET": {
      return createInitialState();
    }

    default: {
      return state;
    }
  }
}

export interface ShipmentDraftApi {
  draft: ShipmentDraft;
  items: PackageItem[];
  conflicts: PendingConflict[];

  setField: (
    field: ScalarField,
    value: unknown,
    source?: FieldSource,
  ) => void;

  setItems: (items: PackageItem[]) => void;

  applyPatch: (patch: DraftPatch, source?: FieldSource) => void;

  resolveConflict: (
    field: ScalarField,
    choice: "current" | "incoming",
  ) => void;

  reset: () => void;
}

const ShipmentDraftContext = createContext<ShipmentDraftApi | null>(null);

interface ShipmentDraftProviderProps {
  children: ReactNode;
  initialItems?: PackageItem[];
}

export function ShipmentDraftProvider({
  children,
  initialItems = [],
}: ShipmentDraftProviderProps) {
  const [state, dispatch] = useReducer(
    reducer,
    initialItems,
    createInitialState,
  );

  const setField = useCallback(
    (
      field: ScalarField,
      value: unknown,
      source: FieldSource = "form",
    ) => {
      dispatch({
        type: "SET_FIELD",
        field,
        value,
        source,
      });
    },
    [],
  );

  const setItems = useCallback((items: PackageItem[]) => {
    dispatch({
      type: "SET_ITEMS",
      items,
    });
  }, []);

  const applyPatch = useCallback(
    (patch: DraftPatch, source: FieldSource = "chat") => {
      dispatch({
        type: "APPLY_PATCH",
        patch,
        source,
      });
    },
    [],
  );

  const resolveConflict = useCallback(
    (field: ScalarField, choice: "current" | "incoming") => {
      dispatch({
        type: "RESOLVE_CONFLICT",
        field,
        choice,
      });
    },
    [],
  );

  const reset = useCallback(() => {
    dispatch({
      type: "RESET",
    });
  }, []);

  const value = useMemo<ShipmentDraftApi>(
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
    [
      state.draft,
      state.conflicts,
      setField,
      setItems,
      applyPatch,
      resolveConflict,
      reset,
    ],
  );

  return (
    <ShipmentDraftContext.Provider value={value}>
      {children}
    </ShipmentDraftContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useShipmentDraft(): ShipmentDraftApi {
  const context = useContext(ShipmentDraftContext);

  if (!context) {
    throw new Error(
      "useShipmentDraft must be used within a ShipmentDraftProvider",
    );
  }

  return context;
}
