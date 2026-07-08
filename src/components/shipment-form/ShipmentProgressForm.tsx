// src/components/shipment-form/ShipmentProgressForm.tsx

import { useCallback, useEffect, useRef, useState } from "react";
import { format, isBefore } from "date-fns";

import type { PackageItem } from "@/lib/shipping-data";

import LocationStep from "@/components/shipment-form/LocationStep";
import DateStep from "@/components/shipment-form/DateStep";
import PackageDetailsStep from "@/components/shipment-form/PackageDetailsStep";

import { isPackageComplete } from "@/components/shipment-form/PackageCard";

import { useShipmentDraftFormSync } from "@/state/useShipmentDraftFormSync";

type SectionId = "location" | "dates" | "details";
type ActiveSection = SectionId | null;

export interface ShipmentSearchPayload {
  origin: string;
  dest: string;
  dropDate: Date;
  delivDate: Date;
  dropDateStr: string;
  delivDateStr: string;
  packages: PackageItem[];
  totalWeight: number;
  totalItems: number;
  packageSummary: string;
}

export interface ShipmentDraftSnapshot {
  origin: string;
  dest: string;
  dropDate?: Date;
  delivDate?: Date;
  dropDateStr: string;
  delivDateStr: string;
  packages: PackageItem[];
  totalWeight: number;
  totalItems: number;
  packageSummary: string;
  locationComplete: boolean;
  datesComplete: boolean;
  allPackagesValid: boolean;
}

interface ShipmentProgressFormProps {
  onSearch: (payload: ShipmentSearchPayload) => void;
  onDraftChange?: (snapshot: ShipmentDraftSnapshot) => void;
  isSearching?: boolean;
  hasResults?: boolean;
}

function clonePackages(packages: PackageItem[]) {
  return packages.map((pkg) => ({ ...pkg }));
}

function getTotalWeight(packages: PackageItem[]) {
  return packages.reduce((total, pkg) => {
    const qty = Number(pkg.qty);
    const weight = Number(pkg.weight);

    if (!Number.isFinite(qty) || !Number.isFinite(weight)) {
      return total;
    }

    return total + qty * weight;
  }, 0);
}

function getTotalItems(packages: PackageItem[]) {
  return packages.reduce((total, pkg) => {
    const qty = Number(pkg.qty);

    if (!Number.isFinite(qty)) {
      return total;
    }

    return total + qty;
  }, 0);
}

function buildPackageSummary(packages: PackageItem[]) {
  const totalItems = getTotalItems(packages);
  const totalWeight = getTotalWeight(packages);

  return `${totalItems} pkg${totalItems > 1 ? "s" : ""} · ${totalWeight} lbs`;
}

function createDefaultPackage(type = "luggage"): PackageItem {
  return {
    type,
    qty: "1",
    weight: "",
    l: "",
    w: "",
    h: "",
    handling: "standard",
  };
}

export default function ShipmentProgressForm({
  onSearch,
  onDraftChange,
  isSearching = false,
  hasResults = false,
}: ShipmentProgressFormProps) {
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");

  const [originSelected, setOriginSelected] = useState(false);
  const [destSelected, setDestSelected] = useState(false);

  const [dropDate, setDropDate] = useState<Date | undefined>();
  const [delivDate, setDelivDate] = useState<Date | undefined>();

  const [packages, setPackages] = useState<PackageItem[]>([
    createDefaultPackage("luggage"),
  ]);

  const [activeSection, setActiveSection] =
    useState<ActiveSection>("location");

  const [activePackageIndex, setActivePackageIndex] = useState(0);
  const [showErr, setShowErr] = useState(false);

  const destRef = useRef<HTMLInputElement | null>(null);

  const [locationSelectionVersion, setLocationSelectionVersion] = useState(0);
  const [dateSelectionVersion, setDateSelectionVersion] = useState(0);

  const locationOpenedAtVersion = useRef(0);
  const dateOpenedAtVersion = useRef(0);

  const dropDateStr = dropDate ? format(dropDate, "yyyy-MM-dd") : "";
  const delivDateStr = delivDate ? format(delivDate, "yyyy-MM-dd") : "";

  const locationComplete = Boolean(
    origin.trim() && dest.trim() && originSelected && destSelected,
  );

  const datesComplete = Boolean(
    dropDate && delivDate && !isBefore(delivDate, dropDate),
  );

  const totalWeight = getTotalWeight(packages);
  const totalItems = getTotalItems(packages);
  const packageSummary = buildPackageSummary(packages);
  const allPackagesValid = packages.every(isPackageComplete);

  useShipmentDraftFormSync({
    origin,
    setOrigin: (value) => {
      setOrigin(value);
      setOriginSelected(true);
      setLocationSelectionVersion((prev) => prev + 1);
    },
    destination: dest,
    setDestination: (value) => {
      setDest(value);
      setDestSelected(true);
      setLocationSelectionVersion((prev) => prev + 1);
    },
    dropDate,
    setDropDate: (value) => {
      setDropDate(value);
      setDateSelectionVersion((prev) => prev + 1);
    },
    deliveryDate: delivDate,
    setDeliveryDate: (value) => {
      setDelivDate(value);
      setDateSelectionVersion((prev) => prev + 1);
    },
    weightLbs: packages[0]?.weight ?? "",
    setWeightLbs: (value) => {
      setPackages((prev) => {
        if (!prev.length) return prev;

        return [{ ...prev[0], weight: String(value) }, ...prev.slice(1)];
      });
    },
    packages,
    setPackages,
  });

  useEffect(() => {
    if (dropDate && delivDate && isBefore(delivDate, dropDate)) {
      setDelivDate(undefined);
    }
  }, [dropDate, delivDate]);

  useEffect(() => {
    const userSelectedAfterOpening =
      locationSelectionVersion > locationOpenedAtVersion.current;

    if (
      locationComplete &&
      activeSection === "location" &&
      userSelectedAfterOpening
    ) {
      setActiveSection("dates");
      setShowErr(false);
    }
  }, [locationComplete, activeSection, locationSelectionVersion]);

  useEffect(() => {
    const userSelectedAfterOpening =
      dateSelectionVersion > dateOpenedAtVersion.current;

    if (
      datesComplete &&
      activeSection === "dates" &&
      userSelectedAfterOpening
    ) {
      setActiveSection("details");
      setShowErr(false);
    }
  }, [datesComplete, activeSection, dateSelectionVersion]);

  useEffect(() => {
    onDraftChange?.({
      origin,
      dest,
      dropDate,
      delivDate,
      dropDateStr,
      delivDateStr,
      packages: clonePackages(packages),
      totalWeight,
      totalItems,
      packageSummary,
      locationComplete,
      datesComplete,
      allPackagesValid,
    });
  }, [
    origin,
    dest,
    dropDate,
    delivDate,
    dropDateStr,
    delivDateStr,
    packages,
    totalWeight,
    totalItems,
    packageSummary,
    locationComplete,
    datesComplete,
    allPackagesValid,
    onDraftChange,
  ]);

  const openLocationStep = useCallback(() => {
    locationOpenedAtVersion.current = locationSelectionVersion;
    setActiveSection("location");
  }, [locationSelectionVersion]);

  const openDateStep = useCallback(() => {
    dateOpenedAtVersion.current = dateSelectionVersion;
    setActiveSection("dates");
  }, [dateSelectionVersion]);

  const openPackageStep = useCallback(() => {
    setActiveSection("details");
  }, []);

  const handleOriginChange = useCallback((value: string) => {
    setOrigin(value);
    setOriginSelected(false);
    setActiveSection("location");
  }, []);

  const handleDestChange = useCallback((value: string) => {
    setDest(value);
    setDestSelected(false);
    setActiveSection("location");
  }, []);

  const handleOriginSelect = useCallback(
    (city: string) => {
      setOrigin(city);
      setOriginSelected(true);
      setShowErr(false);
      setLocationSelectionVersion((prev) => prev + 1);

      if (!destSelected) {
        setTimeout(() => {
          destRef.current?.focus();
        }, 50);
      }
    },
    [destSelected],
  );

  const handleDestSelect = useCallback((city: string) => {
    setDest(city);
    setDestSelected(true);
    setShowErr(false);
    setLocationSelectionVersion((prev) => prev + 1);
  }, []);

  const handleSwapLocations = useCallback(() => {
    setOrigin(dest);
    setDest(origin);

    setOriginSelected(destSelected);
    setDestSelected(originSelected);

    setLocationSelectionVersion((prev) => prev + 1);
    setActiveSection("location");
  }, [origin, dest, originSelected, destSelected]);

  const handleDropDateChange = useCallback((date: Date | undefined) => {
    setDropDate(date);
    setDateSelectionVersion((prev) => prev + 1);
    setShowErr(false);
  }, []);

  const handleDelivDateChange = useCallback((date: Date | undefined) => {
    setDelivDate(date);
    setDateSelectionVersion((prev) => prev + 1);
    setShowErr(false);
  }, []);

  const updatePackage = (
    index: number,
    field: keyof PackageItem,
    value: string,
  ) => {
    const numericFields: (keyof PackageItem)[] = [
      "qty",
      "weight",
      "l",
      "w",
      "h",
    ];

    if (numericFields.includes(field) && value !== "") {
      const numberValue = Number(value);

      if (!Number.isFinite(numberValue) || numberValue < 0) {
        return;
      }

      if (field === "qty" && !Number.isInteger(numberValue)) {
        return;
      }
    }

    setPackages((prev) =>
      prev.map((pkg, idx) =>
        idx === index
          ? {
              ...pkg,
              [field]: value,
            }
          : pkg,
      ),
    );

    setActiveSection("details");
  };

  const addPackage = () => {
    setPackages((prev) => {
      const next = [...prev, createDefaultPackage("boxes")];
      setActivePackageIndex(next.length - 1);
      return next;
    });

    setActiveSection("details");
  };

  const removePackage = (index: number) => {
    if (packages.length <= 1) return;

    setPackages((prev) => prev.filter((_, idx) => idx !== index));

    setActivePackageIndex((prevIndex) => {
      if (index < prevIndex) return Math.max(0, prevIndex - 1);
      if (index === prevIndex) return Math.max(0, prevIndex - 1);
      return prevIndex;
    });

    setActiveSection("details");
  };

  const handleSearch = () => {
    if (!locationComplete) {
      setShowErr(true);
      openLocationStep();
      return;
    }

    if (!dropDate || !delivDate || !datesComplete) {
      setShowErr(true);
      openDateStep();
      return;
    }

    if (!allPackagesValid) {
      setShowErr(true);
      openPackageStep();

      const firstInvalidIndex = packages.findIndex(
        (pkg) => !isPackageComplete(pkg),
      );

      if (firstInvalidIndex >= 0) {
        setActivePackageIndex(firstInvalidIndex);
      }

      return;
    }

    setShowErr(false);
    setActiveSection(null);

    onSearch({
      origin,
      dest,
      dropDate,
      delivDate,
      dropDateStr,
      delivDateStr,
      packages: clonePackages(packages),
      totalWeight,
      totalItems,
      packageSummary,
    });
  };

  return (
    <div className="ss-progress-form">
      <LocationStep
        origin={origin}
        dest={dest}
        active={activeSection === "location"}
        complete={locationComplete}
        showError={showErr && activeSection === "location"}
        destRef={destRef}
        onOriginChange={handleOriginChange}
        onDestChange={handleDestChange}
        onOriginSelect={handleOriginSelect}
        onDestSelect={handleDestSelect}
        onSwap={handleSwapLocations}
        onEdit={openLocationStep}
      />

      {locationComplete && (
        <DateStep
          dropDate={dropDate}
          delivDate={delivDate}
          active={activeSection === "dates"}
          complete={datesComplete}
          showError={showErr && activeSection === "dates"}
          onDropDateChange={handleDropDateChange}
          onDelivDateChange={handleDelivDateChange}
          onEdit={openDateStep}
        />
      )}

      {datesComplete && (
        <PackageDetailsStep
          packages={packages}
          active={activeSection === "details"}
          complete={allPackagesValid}
          packageSummary={packageSummary}
          activePackageIndex={activePackageIndex}
          showErrors={showErr && activeSection === "details"}
          onEdit={openPackageStep}
          onActivePackageChange={(index: number) => {
            setActivePackageIndex(index);
            openPackageStep();
          }}
          onPackageChange={updatePackage}
          onAddPackage={addPackage}
          onRemovePackage={removePackage}
        />
      )}

      {datesComplete && (
        <button
          type="button"
          className="ss-find-btn"
          onClick={handleSearch}
          disabled={isSearching}
        >
          {isSearching
            ? "Finding options..."
            : hasResults
              ? "Update shipping options"
              : "Find best shipping options"}
        </button>
      )}
    </div>
  );
}

export { isPackageComplete };