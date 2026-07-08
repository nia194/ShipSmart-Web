import { useEffect, useRef } from "react";
import { useShipmentDraft } from "@/state/ShipmentDraftContext";
import type { PackageItem } from "@/lib/shipping-data";

type DateValue = Date | undefined;

type UseShipmentDraftFormSyncArgs = {
  origin: string;
  setOrigin: (value: string) => void;

  destination: string;
  setDestination: (value: string) => void;

  dropDate: DateValue;
  setDropDate: (value: DateValue) => void;

  deliveryDate: DateValue;
  setDeliveryDate: (value: DateValue) => void;

  weightLbs: string;
  setWeightLbs: (value: string) => void;

  packages?: PackageItem[];
  setPackages?: (items: PackageItem[]) => void;
};

function isEmpty(value: unknown) {
  return value === undefined || value === null || String(value).trim() === "";
}

function asString(value: unknown) {
  if (isEmpty(value)) return "";
  return String(value);
}

function dateToIso(date: DateValue) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function isoToDate(value: unknown): DateValue {
  if (isEmpty(value)) return undefined;

  const text = String(value).slice(0, 10);
  const date = new Date(`${text}T00:00:00`);

  if (Number.isNaN(date.getTime())) return undefined;

  return date;
}

function datesSame(a: DateValue, b: DateValue) {
  return dateToIso(a) === dateToIso(b);
}

function shouldApplyDraftValue(source: unknown) {
  return source === "chat" || source === "hydrated";
}

function shouldApplyTextValue(source: unknown, nextValue: string, currentValue: string) {
  if (!shouldApplyDraftValue(source)) return false;
  if (!nextValue) return false;
  if (nextValue === currentValue) return false;

  // Do not let chat silently overwrite what the user already typed.
  return isEmpty(currentValue);
}

function shouldApplyDateValue(
  source: unknown,
  nextValue: DateValue,
  currentValue: DateValue,
) {
  if (!shouldApplyDraftValue(source)) return false;
  if (!nextValue) return false;
  if (datesSame(nextValue, currentValue)) return false;

  // Do not let chat silently overwrite a manually selected date.
  return !currentValue;
}

function isPackageFieldEmpty(value: unknown) {
  return value === undefined || value === null || String(value).trim() === "";
}

function isPackageEffectivelyEmpty(pkg: PackageItem) {
  return (
    isPackageFieldEmpty(pkg.weight) &&
    isPackageFieldEmpty(pkg.l) &&
    isPackageFieldEmpty(pkg.w) &&
    isPackageFieldEmpty(pkg.h)
  );
}

function packagesAreEffectivelyEmpty(packages?: PackageItem[]) {
  if (!packages?.length) return true;
  return packages.every(isPackageEffectivelyEmpty);
}

function itemsSame(a?: PackageItem[], b?: PackageItem[]) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

function clonePackages(items: PackageItem[]) {
  return items.map((item) => ({ ...item }));
}

export function useShipmentDraftFormSync({
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
  packages,
  setPackages,
}: UseShipmentDraftFormSyncArgs) {
  const { draft } = useShipmentDraft();

  const formRef = useRef({
    origin,
    destination,
    dropDate,
    deliveryDate,
    weightLbs,
    packages,
  });

  const lastAppliedItemsRef = useRef("");

  useEffect(() => {
    formRef.current.origin = origin;
  }, [origin]);

  useEffect(() => {
    formRef.current.destination = destination;
  }, [destination]);

  useEffect(() => {
    formRef.current.dropDate = dropDate;
  }, [dropDate]);

  useEffect(() => {
    formRef.current.deliveryDate = deliveryDate;
  }, [deliveryDate]);

  useEffect(() => {
    formRef.current.weightLbs = weightLbs;
  }, [weightLbs]);

  useEffect(() => {
    formRef.current.packages = packages;
  }, [packages]);

  // Assistant/draft -> visible form only.
  // Do not write form -> draft on every keypress. That was causing input glitches.

  useEffect(() => {
    const nextOrigin = asString(draft.origin?.value);

    if (
      shouldApplyTextValue(
        draft.origin?.source,
        nextOrigin,
        formRef.current.origin,
      )
    ) {
      formRef.current.origin = nextOrigin;
      setOrigin(nextOrigin);
    }
  }, [draft.origin?.value, draft.origin?.source, setOrigin]);

  useEffect(() => {
    const nextDestination = asString(draft.destination?.value);

    if (
      shouldApplyTextValue(
        draft.destination?.source,
        nextDestination,
        formRef.current.destination,
      )
    ) {
      formRef.current.destination = nextDestination;
      setDestination(nextDestination);
    }
  }, [draft.destination?.value, draft.destination?.source, setDestination]);

  useEffect(() => {
    const nextDropDate = isoToDate(draft.dropOffDate?.value);

    if (
      shouldApplyDateValue(
        draft.dropOffDate?.source,
        nextDropDate,
        formRef.current.dropDate,
      )
    ) {
      formRef.current.dropDate = nextDropDate;
      setDropDate(nextDropDate);
    }
  }, [draft.dropOffDate?.value, draft.dropOffDate?.source, setDropDate]);

  useEffect(() => {
    const nextDeliveryDate = isoToDate(draft.deliveryDate?.value);

    if (
      shouldApplyDateValue(
        draft.deliveryDate?.source,
        nextDeliveryDate,
        formRef.current.deliveryDate,
      )
    ) {
      formRef.current.deliveryDate = nextDeliveryDate;
      setDeliveryDate(nextDeliveryDate);
    }
  }, [draft.deliveryDate?.value, draft.deliveryDate?.source, setDeliveryDate]);

  useEffect(() => {
    const nextWeight = asString(draft.weightLbs?.value);

    if (
      shouldApplyTextValue(
        draft.weightLbs?.source,
        nextWeight,
        formRef.current.weightLbs,
      )
    ) {
      formRef.current.weightLbs = nextWeight;
      setWeightLbs(nextWeight);
    }
  }, [draft.weightLbs?.value, draft.weightLbs?.source, setWeightLbs]);

  useEffect(() => {
    if (!setPackages) return;
    if (!draft.items?.length) return;

    const nextItemsKey = JSON.stringify(draft.items);

    if (nextItemsKey === lastAppliedItemsRef.current) return;

    if (!packagesAreEffectivelyEmpty(formRef.current.packages)) return;

    if (!itemsSame(draft.items, formRef.current.packages)) {
      const nextItems = clonePackages(draft.items);

      lastAppliedItemsRef.current = nextItemsKey;
      formRef.current.packages = nextItems;
      setPackages(nextItems);
    }
  }, [draft.items, setPackages]);
}