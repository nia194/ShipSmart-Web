/**
 * The shared shipment draft — one typed model both the conventional form and the
 * conversational chat read from and write to.
 *
 * Scalar fields are wrapped in `Tracked<T>` (value + provenance + timestamp) so the
 * deterministic merge rules can resolve form-vs-chat conflicts and the UI can show
 * "from chat" subtly. `items` stays the form's authoritative multi-item editor.
 *
 * Merge policy (mirrors the server's `fold_turn`):
 *  - Empty never overwrites non-empty.
 *  - A manual FORM edit always wins for that field (latest user action).
 *  - CHAT fills empty fields freely; on a genuine conflict with a FORM value it does
 *    NOT overwrite — it records a `PendingConflict` for the user to resolve.
 *  - `hydrated` (Java) loses to any explicit user (form/chat) write.
 *  - Values equivalent after normalization are a no-op (preserve source + timestamp),
 *    so an echoed value never re-stamps a form field as "chat".
 */
import type { Priority } from "@/components/shipping/compare.types";
import type { ConciergeState } from "@/lib/concierge-api";
import type { PackageItem } from "@/lib/shipping-data";

export type FieldSource = "form" | "chat" | "hydrated";

export interface Tracked<T> {
  value: T;
  source: FieldSource;
  at: number;
}

export interface ShipmentDraft {
  origin?: Tracked<string>;
  destination?: Tracked<string>;
  originCountry?: Tracked<string>;
  destinationCountry?: Tracked<string>;
  dropOffDate?: Tracked<string>; // yyyy-MM-dd
  deliveryDate?: Tracked<string>;
  weightLbs?: Tracked<number>;
  priority?: Tracked<Priority>;
  description?: Tracked<string>;
  declaredValueUsd?: Tracked<number>;
  items: PackageItem[];
}

export type ScalarField =
  | "origin"
  | "destination"
  | "originCountry"
  | "destinationCountry"
  | "dropOffDate"
  | "deliveryDate"
  | "weightLbs"
  | "priority"
  | "description"
  | "declaredValueUsd";

export interface PendingConflict {
  field: ScalarField;
  current: unknown;
  incoming: unknown;
}

export const emptyDraft = (): ShipmentDraft => ({ items: [] });

// slot key (server wire) ↔ scalar draft field
export const SLOT_FIELD_MAP: Record<string, ScalarField> = {
  origin: "origin",
  destination: "destination",
  origin_country: "originCountry",
  destination_country: "destinationCountry",
  drop_off_date: "dropOffDate",
  expected_delivery_date: "deliveryDate",
  weight_lbs: "weightLbs",
  priority: "priority",
  description: "description",
  declared_value_usd: "declaredValueUsd",
};

export function isEmptyValue(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

export function normalizeValue(v: unknown): unknown {
  if (typeof v === "string") return v.trim().toLowerCase().replace(/\s+/g, " ");
  return v;
}

/** Equal after normalization, treating "Atlanta" == "Atlanta, GA". */
export function valuesEquivalent(a: unknown, b: unknown): boolean {
  const na = normalizeValue(a);
  const nb = normalizeValue(b);
  if (na === nb) return true;
  if (typeof na === "string" && typeof nb === "string") {
    const ha = na.split(",")[0].trim();
    const hb = nb.split(",")[0].trim();
    if (ha && ha === hb) return true;
  }
  return false;
}

export interface MergeResult {
  draft: ShipmentDraft;
  conflict?: PendingConflict;
}

/** Merge a single field per the policy above. Pure. */
export function mergeField(
  draft: ShipmentDraft,
  field: ScalarField,
  value: unknown,
  source: FieldSource,
  at: number = Date.now(),
): MergeResult {
  if (isEmptyValue(value)) return { draft };
  const existing = draft[field] as Tracked<unknown> | undefined;
  if (!existing) {
    return { draft: { ...draft, [field]: { value, source, at } } };
  }
  if (valuesEquivalent(existing.value, value)) {
    return { draft }; // no-op: keep existing source + timestamp
  }
  if (source === "form") {
    return { draft: { ...draft, [field]: { value, source, at } } }; // manual edit wins
  }
  if (source === "hydrated") {
    if (existing.source === "form" || existing.source === "chat") return { draft };
    return { draft: { ...draft, [field]: { value, source, at } } };
  }
  // source === "chat"
  if (existing.source === "form") {
    return { draft, conflict: { field, current: existing.value, incoming: value } };
  }
  return { draft: { ...draft, [field]: { value, source, at } } }; // newest explicit wins
}

/** Apply many fields at once, accumulating any conflicts. Pure. */
export function applyPatchToDraft(
  draft: ShipmentDraft,
  patch: Partial<Record<ScalarField, unknown>>,
  source: FieldSource,
  at: number = Date.now(),
): { draft: ShipmentDraft; conflicts: PendingConflict[] } {
  let next = draft;
  const conflicts: PendingConflict[] = [];
  for (const [field, value] of Object.entries(patch) as [ScalarField, unknown][]) {
    const r = mergeField(next, field, value, source, at);
    next = r.draft;
    if (r.conflict) conflicts.push(r.conflict);
  }
  return { draft: next, conflicts };
}

const toNumber = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : undefined;
};

/** Map the draft → the concierge ConversationState the client sends each turn. */
export function draftToConciergeState(
  draft: ShipmentDraft,
  prev?: ConciergeState | null,
): ConciergeState {
  const item = draft.items[0];
  const slots: Record<string, unknown> = {};
  const put = (k: string, v: unknown) => {
    if (!isEmptyValue(v)) slots[k] = v;
  };
  put("origin", draft.origin?.value);
  put("destination", draft.destination?.value);
  put("origin_country", draft.originCountry?.value);
  put("destination_country", draft.destinationCountry?.value);
  put("drop_off_date", draft.dropOffDate?.value);
  put("expected_delivery_date", draft.deliveryDate?.value);
  put("weight_lbs", draft.weightLbs?.value ?? toNumber(item?.weight));
  put("length_in", toNumber(item?.l));
  put("width_in", toNumber(item?.w));
  put("height_in", toNumber(item?.h));
  put("category", item?.type);
  put("description", draft.description?.value);
  put("declared_value_usd", draft.declaredValueUsd?.value);
  put("priority", draft.priority?.value);
  return {
    slots,
    intent: prev?.intent ?? null,
    status: prev?.status ?? "gathering",
    pending_clarification: prev?.pending_clarification ?? null,
    turns: prev?.turns ?? 0,
  };
}

/**
 * Diff the echoed full state against the current draft and emit ONLY the scalar
 * fields that genuinely changed — so applying it as "chat" never re-stamps a
 * form-typed field (Resolved decision: the back-channel patches only real changes).
 */
export function conciergeStateToPatch(
  state: ConciergeState,
  draft: ShipmentDraft,
): Partial<Record<ScalarField, unknown>> {
  const patch: Partial<Record<ScalarField, unknown>> = {};
  const slots = state.slots ?? {};
  for (const [slot, field] of Object.entries(SLOT_FIELD_MAP)) {
    const incoming = slots[slot];
    if (isEmptyValue(incoming)) continue;
    const current = (draft[field] as Tracked<unknown> | undefined)?.value;
    if (current !== undefined && valuesEquivalent(current, incoming)) continue;
    patch[field] = incoming;
  }
  return patch;
}
