/**
 * Two-way sync between the conventional shipment form fields and the shared
 * ShipmentDraft, so the conversational concierge can PRE-FILL the form
 * (draft → form) and knows what the user already typed (form → draft).
 *
 * Manual form edits use the "form" source, which the draft's merge rules treat as
 * authoritative (they win, or surface a conflict the ConciergePanel resolves); the
 * concierge writes with the "chat" source and only fills genuine gaps. The effects
 * converge (a mirrored value normalizes to a no-op), so there is no render loop.
 *
 * Must be called within a ShipmentDraftProvider.
 */
import { useEffect } from "react";

import { format } from "date-fns";

import { useShipmentDraft } from "@/state/ShipmentDraftContext";

export interface FormDraftBinding {
  origin: string;
  setOrigin: (v: string) => void;
  destination: string;
  setDestination: (v: string) => void;
  dropDate?: Date;
  setDropDate: (d: Date | undefined) => void;
  deliveryDate?: Date;
  setDeliveryDate: (d: Date | undefined) => void;
  /** Primary package weight, as the form stores it (a string). */
  weightLbs: string;
  setWeightLbs: (v: string) => void;
}

const iso = (d?: Date) => (d ? format(d, "yyyy-MM-dd") : "");

function parseIso(v: string): Date | undefined {
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function useShipmentDraftFormSync(form: FormDraftBinding): void {
  const { draft, setField } = useShipmentDraft();

  // ── form → draft (user edits; "form" wins / records conflicts) ──────────────
  useEffect(() => {
    if (form.origin) setField("origin", form.origin, "form");
  }, [form.origin, setField]);
  useEffect(() => {
    if (form.destination) setField("destination", form.destination, "form");
  }, [form.destination, setField]);
  useEffect(() => {
    const s = iso(form.dropDate);
    if (s) setField("dropOffDate", s, "form");
  }, [form.dropDate, setField]);
  useEffect(() => {
    const s = iso(form.deliveryDate);
    if (s) setField("deliveryDate", s, "form");
  }, [form.deliveryDate, setField]);
  useEffect(() => {
    const w = Number.parseFloat(form.weightLbs);
    if (Number.isFinite(w) && w > 0) setField("weightLbs", w, "form");
  }, [form.weightLbs, setField]);

  // ── draft → form (concierge pre-fills; only when it genuinely differs) ──────
  const dOrigin = draft.origin?.value;
  useEffect(() => {
    if (typeof dOrigin === "string" && dOrigin && dOrigin !== form.origin) form.setOrigin(dOrigin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dOrigin]);

  const dDest = draft.destination?.value;
  useEffect(() => {
    if (typeof dDest === "string" && dDest && dDest !== form.destination) form.setDestination(dDest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dDest]);

  const dDrop = draft.dropOffDate?.value;
  useEffect(() => {
    if (typeof dDrop === "string" && dDrop && dDrop !== iso(form.dropDate)) {
      const d = parseIso(dDrop);
      if (d) form.setDropDate(d);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dDrop]);

  const dDeliv = draft.deliveryDate?.value;
  useEffect(() => {
    if (typeof dDeliv === "string" && dDeliv && dDeliv !== iso(form.deliveryDate)) {
      const d = parseIso(dDeliv);
      if (d) form.setDeliveryDate(d);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dDeliv]);

  const dWeight = draft.weightLbs?.value;
  useEffect(() => {
    if (typeof dWeight === "number" && dWeight > 0 && String(dWeight) !== form.weightLbs) {
      form.setWeightLbs(String(dWeight));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dWeight]);
}
