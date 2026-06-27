// TODO: [MIGRATION] This page uses useShippingQuotes which calls the legacy
// "get-shipping-quotes" Supabase edge function. Migrate to Java/Python API
// per docs/service-boundaries.md when backend is ready.

import { useCallback, useEffect, useRef, useState } from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { CityInput } from "@/components/shipping/CityInput";
import { StepNum } from "@/components/shipping/SharedUI";
import { Section } from "@/components/shipping/QuoteRow";
import { CompareSection } from "@/components/shipping/CompareSection";
import { PackageTypeDropdown } from "@/components/shipping/PackageTypeDropDown";
import {
  PKG_TYPES,
  HANDLING,
  getItemErrors,
  buildBookUrl,
  type PackageItem,
  type ShippingService,
} from "@/lib/shipping-data";
import {
  type CompareOption,
  type Priority,
} from "@/components/shipping/compare.types";
import { buildSnapshotKey } from "@/hooks/useSavedOptions";
import { useShippingQuotes } from "@/hooks/useShippingQuotes";
import { useAuth } from "@/contexts/AuthContext";
import { SaveSignInModal } from "@/components/auth/SaveSignInModal";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import FloatingShipmentAdvisor from "@/components/advisor/FloatingShipmentAdvisor";
import ConciergePanel from "@/components/advisor/ConciergePanel";
import { apiConfig } from "@/config/api";
import { ShipmentDraftProvider } from "@/state/ShipmentDraftContext";
import { useShipmentDraftFormSync } from "@/state/useShipmentDraftFormSync";
import birdPackageVideo from "@/videos/bird-package.mp4";
import labelPrinterVideo from "@/videos/label-printer.mp4";

interface HomePageProps {
  savedIds: Set<string>;
  onSaveService: (
    svc: ShippingService,
    context: {
      origin: string;
      dest: string;
      dropDate: string;
      delivDate: string;
      pkgSummary: string;
      bookUrl: string;
    },
  ) => void;
}

type SectionId = "location" | "dates" | "details";
type EstimateStage = SectionId | null;

const PRIORITY_LABELS: Record<Priority, string> = {
  ontime: "On-time delivery",
  damage: "Damage protection",
  price: "Lowest price",
  speed: "Earliest arrival",
};

const today = startOfDay(new Date());

function NumberField({
  label,
  sublabel,
  value,
  min,
  step,
  placeholder,
  error,
  onChange,
}: {
  label: string;
  sublabel?: string;
  value: string;
  min: number;
  step: number;
  placeholder?: string;
  error?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <label
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#475569",
            textTransform: "uppercase",
            letterSpacing: ".7px",
          }}
        >
          {label}
        </label>

        {sublabel && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#94a3b8",
            }}
          >
            {sublabel}
          </span>
        )}
      </div>

      <input
        className={`ss-sn ${error ? "err" : ""}`}
        type="number"
        min={min}
        step={step}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          height: 44,
          fontSize: 14,
          fontWeight: 800,
          color: "#0f172a",
          borderColor: error ? "#ef4444" : "#dbe3ef",
          background: "#ffffff",
        }}
      />
    </div>
  );
}

const LoadingSkeleton = () => (
  <div style={{ padding: "20px 0" }}>
    {[1, 2].map((s) => (
      <div key={s} style={{ marginBottom: 20 }}>
        <div
          className="shim"
          style={{
            width: 180,
            height: 16,
            borderRadius: 8,
            marginBottom: 10,
          }}
        />

        <div
          style={{
            borderRadius: 14,
            overflow: "hidden",
            border: "1.5px solid #eeeff1",
          }}
        >
          {[1, 2, 3].map((r) => (
            <div
              key={r}
              style={{
                padding: "16px 18px",
                borderBottom: "1px solid #f0f0f2",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                className="shim"
                style={{ width: 32, height: 32, borderRadius: 8 }}
              />

              <div style={{ flex: 1 }}>
                <div
                  className="shim"
                  style={{
                    width: "60%",
                    height: 14,
                    borderRadius: 6,
                    marginBottom: 6,
                  }}
                />
                <div
                  className="shim"
                  style={{ width: "40%", height: 10, borderRadius: 5 }}
                />
              </div>

              <div
                className="shim"
                style={{ width: 60, height: 20, borderRadius: 6 }}
              />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const EstimateStrip = ({ label }: { label: string }) => (
  <div
    style={{
      marginTop: 12,
      marginBottom: 4,
      padding: "14px 16px",
      borderRadius: 10,
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      animation: "fadeIn .3s both",
    }}
  >
    <div style={{ fontSize: 13, color: "#475569" }}>
      <span style={{ fontWeight: 800, color: "#0f172a" }}>
        Starting at $42–$125
      </span>{" "}
      {label}
    </div>
  </div>
);

function serviceToCompareOption(svc: ShippingService): CompareOption {
  const carrierType = ["UPS", "FedEx", "DHL"].includes(svc.carrier)
    ? "private"
    : "public";

  const now = new Date();
  const arrivalMs = now.getTime() + svc.transitDays * 86400000;
  const arrivalDate = new Date(arrivalMs).toISOString().split("T")[0];

  return {
    id: svc.id,
    carrier: svc.carrier,
    service_name: svc.name,
    carrier_type: carrierType,
    price_usd: svc.price,
    arrival_date: arrivalDate,
    arrival_label: svc.date,
    transit_days: svc.transitDays,
    guaranteed: svc.guaranteed,
  };
}

function HomePageInner({ savedIds, onSaveService }: HomePageProps) {
  const { user } = useAuth();

  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [dropDate, setDropDate] = useState<Date | undefined>();
  const [delivDate, setDelivDate] = useState<Date | undefined>();
  const [dropOpen, setDropOpen] = useState(false);
  const [delivOpen, setDelivOpen] = useState(false);

  const [packages, setPackages] = useState<PackageItem[]>([
    {
      type: "luggage",
      qty: "1",
      weight: "",
      l: "",
      w: "",
      h: "",
      handling: "standard",
    },
  ]);

  const [showErr, setShowErr] = useState(false);
  const [shipmentPriority, setShipmentPriority] =
    useState<Priority>("ontime");

  const [activeSection, setActiveSection] = useState<SectionId | null>(
    "location",
  );
  const [completedSections, setCompletedSections] = useState<Set<SectionId>>(
    new Set(),
  );
  const [revealedSections, setRevealedSections] = useState<Set<SectionId>>(
    new Set(["location"]),
  );
  const [estimateStage, setEstimateStage] = useState<EstimateStage>(null);

  const [originCommitted, setOriginCommitted] = useState(false);
  const [destCommitted, setDestCommitted] = useState(false);

  const [resultsLoaded, setResultsLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [pendingSaveService, setPendingSaveService] =
    useState<ShippingService | null>(null);

  const { loading, data, fetchQuotes } = useShippingQuotes();

  // Keep the form and the shared ShipmentDraft in sync so the concierge can pre-fill
  // the form (and not re-ask for what's already typed). No-op unless the concierge is on.
  useShipmentDraftFormSync({
    origin,
    setOrigin,
    destination: dest,
    setDestination: setDest,
    dropDate,
    setDropDate,
    deliveryDate: delivDate,
    setDeliveryDate: setDelivDate,
    weightLbs: packages[0]?.weight ?? "",
    setWeightLbs: (v) =>
      setPackages((prev) => (prev.length ? [{ ...prev[0], weight: v }, ...prev.slice(1)] : prev)),
  });
  const res = useRef<HTMLDivElement>(null);
  const destRef = useRef<HTMLInputElement>(null);

  const dropDateStr = dropDate ? format(dropDate, "yyyy-MM-dd") : "";
  const delivDateStr = delivDate ? format(delivDate, "yyyy-MM-dd") : "";

  const tw = packages.reduce((total, p) => {
    const qty = parseInt(p.qty, 10);
    const weight = parseFloat(p.weight);

    if (!Number.isFinite(qty) || !Number.isFinite(weight)) {
      return total;
    }

    return total + weight * qty;
  }, 0);

  const ti = packages.reduce((total, p) => {
    const qty = parseInt(p.qty, 10);

    if (!Number.isFinite(qty)) {
      return total;
    }

    return total + qty;
  }, 0);

  const allValid = packages.every((p) => {
    const qty = parseInt(p.qty, 10);
    const weight = parseFloat(p.weight);
    const length = parseFloat(p.l);
    const width = parseFloat(p.w);
    const height = parseFloat(p.h);

    return (
      Number.isFinite(qty) &&
      qty >= 1 &&
      Number.isFinite(weight) &&
      weight > 0 &&
      Number.isFinite(length) &&
      length > 0 &&
      Number.isFinite(width) &&
      width > 0 &&
      Number.isFinite(height) &&
      height > 0
    );
  });

  const firstPackage = packages[0];

  const firstPackageType = firstPackage
    ? PKG_TYPES.find((p) => p.id === firstPackage.type)
    : null;

  const firstHandling = firstPackage
    ? HANDLING.find((h) => h.id === firstPackage.handling)
    : null;

  const firstDimensions =
    firstPackage?.l && firstPackage?.w && firstPackage?.h
      ? `${firstPackage.l}×${firstPackage.w}×${firstPackage.h} in`
      : "";

  const shipmentDetailsSummary =
    packages.length === 1
      ? [
          firstPackageType?.title ?? firstPackageType?.label,
          `${tw} lbs`,
          firstDimensions,
          firstHandling?.id !== "standard" ? firstHandling?.label : null,
          PRIORITY_LABELS[shipmentPriority],
        ]
          .filter(Boolean)
          .join(" · ")
      : [`${ti} items`, `${tw} lbs`, PRIORITY_LABELS[shipmentPriority]]
          .filter(Boolean)
          .join(" · ");

  const pkgSummary = `${ti} pkg${ti > 1 ? "s" : ""} · ${tw} lbs`;

  const completeLocation = useCallback(() => {
    setCompletedSections((prev) => new Set([...prev, "location"]));
    setRevealedSections((prev) => new Set([...prev, "dates"]));
    setEstimateStage("location");
    setActiveSection("dates");
  }, []);

  const completeDates = useCallback(
    (currentDropDate: Date | undefined, currentDelivDate: Date | undefined) => {
      if (!currentDropDate || !currentDelivDate) return;

      setCompletedSections((prev) => new Set([...prev, "dates"]));
      setRevealedSections((prev) => new Set([...prev, "details"]));
      setEstimateStage("dates");
      setActiveSection("details");
    },
    [],
  );

  useEffect(() => {
    if (dropDate && delivDate && isBefore(delivDate, dropDate)) {
      setDelivDate(undefined);
    }
  }, [dropDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEditLocation = useCallback(() => {
    setActiveSection("location");
    setOriginCommitted(false);
    setDestCommitted(false);
    setCompletedSections(new Set());
    setEstimateStage(null);
  }, []);

  const handleEditDates = useCallback(() => {
    setActiveSection("dates");

    setCompletedSections((prev) => {
      const updated = new Set(prev);

      if (originCommitted && destCommitted && origin && dest) {
        updated.add("location");
      }

      updated.delete("dates");
      updated.delete("details");
      return updated;
    });

    setEstimateStage("location");
  }, [originCommitted, destCommitted, origin, dest]);

  const handleEditDetails = useCallback(() => {
    setActiveSection("details");

    setCompletedSections((prev) => {
      const updated = new Set(prev);

      if (originCommitted && destCommitted && origin && dest) {
        updated.add("location");
      }

      if (dropDate && delivDate) {
        updated.add("dates");
      }

      updated.delete("details");
      return updated;
    });

    setEstimateStage("dates");
  }, [originCommitted, destCommitted, origin, dest, dropDate, delivDate]);

  const handleSectionClick = useCallback(
    (section: SectionId) => {
      if (section === "location") {
        handleEditLocation();
      } else if (section === "dates") {
        handleEditDates();
      } else {
        handleEditDetails();
      }
    },
    [handleEditLocation, handleEditDates, handleEditDetails],
  );

  const handleSearch = useCallback(() => {
    if (!allValid) {
      setShowErr(true);
      return;
    }

    setShowErr(false);
    setEstimateStage("details");
    setResultsLoaded(true);
    setOpenId(null);

    setCompletedSections((prev) => {
      const updated = new Set(prev);
      updated.add("location");
      updated.add("dates");
      updated.add("details");
      return updated;
    });

    setActiveSection(null);

    setTimeout(
      () => res.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      150,
    );

    fetchQuotes(origin, dest, dropDateStr, delivDateStr, packages);
  }, [allValid, origin, dest, dropDateStr, delivDateStr, packages, fetchQuotes]);

  const bUrl = (svc: ShippingService) =>
    buildBookUrl(svc, origin, dest, dropDateStr, delivDateStr, packages);

  const handleSaveWithAuth = (svc: ShippingService) => {
    if (!user) {
      setPendingSaveService(svc);
      setSignInModalOpen(true);
      return;
    }

    onSaveService(svc, {
      origin,
      dest,
      dropDate: dropDateStr,
      delivDate: delivDateStr,
      pkgSummary,
      bookUrl: bUrl(svc),
    });
  };

  const handleSignInComplete = () => {
    if (pendingSaveService) {
      onSaveService(pendingSaveService, {
        origin,
        dest,
        dropDate: dropDateStr,
        delivDate: delivDateStr,
        pkgSummary,
        bookUrl: bUrl(pendingSaveService),
      });

      setPendingSaveService(null);
    }
  };

  const addPkg = () =>
    setPackages([
      ...packages,
      {
        type: "boxes",
        qty: "1",
        weight: "",
        l: "",
        w: "",
        h: "",
        handling: "standard",
      },
    ]);

  const rmPkg = (i: number) => {
    if (packages.length <= 1) return;

    setPackages(packages.filter((_, idx) => idx !== i));
  };

  const upPkg = (i: number, f: string, v: string) => {
    const numericFields = ["qty", "weight", "l", "w", "h"];

    if (numericFields.includes(f)) {
      if (v === "") {
        setPackages(
          packages.map((p, idx) => (idx === i ? { ...p, [f]: v } : p)),
        );
        return;
      }

      const num = Number(v);

      if (!Number.isFinite(num) || num <= 0) {
        return;
      }

      if (f === "qty" && !Number.isInteger(num)) {
        return;
      }
    }

    setPackages(
      packages.map((p, idx) => (idx === i ? { ...p, [f]: v } : p)),
    );
  };

  const toggle = (id: string) => setOpenId(openId === id ? null : id);

  const isServiceSaved = (svc: ShippingService) => {
    const key = buildSnapshotKey(svc.id, origin, dest, dropDateStr, delivDateStr);
    return savedIds.has(key);
  };

  const showFinalCTA =
    (activeSection === "details" && allValid) ||
    (completedSections.has("location") &&
      completedSections.has("dates") &&
      completedSections.has("details"));

  const ctaLabel = resultsLoaded
    ? "Update your search"
    : "Find best shipping options";

  const showDates = revealedSections.has("dates");
  const showDetails = revealedSections.has("details");

  const handleOriginSelect = useCallback(
    (city: string) => {
      setOrigin(city);
      setOriginCommitted(true);

      if (destCommitted) {
        completeLocation();
      } else {
        setTimeout(() => destRef.current?.focus(), 50);
      }
    },
    [destCommitted, completeLocation],
  );

  const handleDestSelect = useCallback(
    (city: string) => {
      setDest(city);
      setDestCommitted(true);

      if (originCommitted) {
        completeLocation();
      }
    },
    [originCommitted, completeLocation],
  );

  const handleDropDateSelect = useCallback(
    (d: Date | undefined) => {
      setDropDate(d);
      setDropOpen(false);

      if (d && delivDate && !isBefore(delivDate, d)) {
        completeDates(d, delivDate);
      } else if (!delivDate) {
        setTimeout(() => setDelivOpen(true), 150);
      }
    },
    [delivDate, completeDates],
  );

  const handleDelivDateSelect = useCallback(
    (d: Date | undefined) => {
      setDelivDate(d);
      setDelivOpen(false);

      if (dropDate && d) {
        completeDates(dropDate, d);
      }
    },
    [dropDate, completeDates],
  );

  return (
    <div>
        <section
          style={{
            position: "relative",
            overflow: "visible",
            background: "#ffffff",
            minHeight: 344,
            padding: "64px 20px 28px",
            textAlign: "center",
            animation: "fadeIn .5s both",
          }}
        >
          <video
            src={birdPackageVideo}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "4%",
              top: 80,
              width: "min(24vw, 360px)",
              maxWidth: 460,
              minWidth: 250,
              height: "auto",
              objectFit: "contain",
              pointerEvents: "none",
            }}
          />

          <video
            src={labelPrinterVideo}
            autoPlay
            muted
            playsInline
            aria-hidden="true"
            style={{
              position: "absolute",
              right: "3%",
              top: 42,
              width: "min(29vw, 400px)",
              maxWidth: 500,
              minWidth: 340,
              height: "auto",
              objectFit: "contain",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 2,
              maxWidth: 820,
              margin: "0 auto",
            }}
          >
            <h1
              style={{
                fontSize: "clamp(34px, 4.4vw, 42px)",
                lineHeight: 1.08,
                fontWeight: 900,
                letterSpacing: "-2px",
                color: "#020617",
                margin: 0,
              }}
            >
              Know the {" "}
              <span style={{ color: "#1d4ed8" }}>best shipping choice</span>
              <br />
              before you book, without
              <br />
              sorting through every rate.
            </h1>

            <p
              style={{
                maxWidth: 560,
                margin: "24px auto 0",
                fontSize: 16,
                lineHeight: 1.45,
                color: "#0f172a",
                fontWeight: 500,
              }}
            >
              ShipSmart ranks each option against your deadline, budget, and
              delivery risk so you know {" "}
              <span style={{ color: "#1d4ed8", fontWeight: 700 }}>
                what to book.
              </span>
            </p>
          </div>
          <div
        style={{
          maxWidth: 780,
          margin: resultsLoaded ? "8px auto 0" : "50px auto 0",
          padding: "0 16px",
        }}
      >
        {apiConfig.useConcierge && <ConciergePanel />}

        {/* LOCATION */}
        <div
          className="ss-card"
          style={{
            zIndex: 10,
            animation: "fadeUp .3s both",
            transition: "all 0.3s ease",
          }}
        >
          {completedSections.has("location") && activeSection !== "location" ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                cursor: "pointer",
              }}
              onClick={() => handleSectionClick("location")}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: "#2563EB",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>

                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: "#0f172a",
                  }}
                >
                  {origin} → {dest}
                </span>
              </div>

              <button
                className="ss-btn ss-btn-outline ss-btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditLocation();
                }}
              >
                Edit
              </button>
            </div>
          ) : activeSection === "location" ? (
            <div style={{ padding: "20px", animation: "fadeIn .2s both" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <StepNum n="1" />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  Pickup & Delivery Location
                </span>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <CityInput
                  value={origin}
                  onChange={setOrigin}
                  onSelect={handleOriginSelect}
                  placeholder="From city or ZIP"
                  icon={"◉"}
                />

                <div
                  onClick={() => {
                    const t = origin;
                    setOrigin(dest);
                    setDest(t);
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f3f4f6",
                    cursor: "pointer",
                    fontSize: 14,
                    color: "#64748b",
                    flexShrink: 0,
                    marginTop: 8,
                    transition: "all 0.2s ease",
                  }}
                  title="Swap"
                >
                  ⇄
                </div>

                <CityInput
                  inputRef={destRef as React.RefObject<HTMLInputElement>}
                  value={dest}
                  onChange={setDest}
                  onSelect={handleDestSelect}
                  placeholder="To city or ZIP"
                  icon={"◎"}
                />
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: "14px 18px",
                color: "#64748b",
                cursor: "pointer",
              }}
              onClick={() => handleSectionClick("location")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <StepNum n="1" />
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  {origin && dest
                    ? `${origin} → ${dest}`
                    : "Pickup & Delivery Location"}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 12 }}>→</span>
              </div>
            </div>
          )}
        </div>

        {estimateStage === "location" && <EstimateStrip label="Based on route" />}

        {/* DATES */}
        {showDates && (
          <div
            className="ss-card"
            style={{ animation: "fadeUp .3s both", transition: "all 0.3s ease" }}
          >
            {completedSections.has("dates") && activeSection !== "dates" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px",
                  cursor: "pointer",
                }}
                onClick={() => handleSectionClick("dates")}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: "#2563EB",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </div>

                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#0f172a",
                    }}
                  >
                    {dropDate ? format(dropDate, "MMM d, yyyy") : ""} →{" "}
                    {delivDate ? format(delivDate, "MMM d, yyyy") : ""}
                  </span>
                </div>

                <button
                  className="ss-btn ss-btn-outline ss-btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditDates();
                  }}
                >
                  Edit
                </button>
              </div>
            ) : activeSection === "dates" ? (
              <div style={{ padding: "20px", animation: "fadeIn .2s both" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  <StepNum n="2" />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#0f172a",
                    }}
                  >
                    Dates
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#475569",
                        display: "block",
                        marginBottom: 6,
                        textTransform: "uppercase",
                        letterSpacing: ".7px",
                      }}
                    >
                      Drop-off
                    </label>

                    <Popover open={dropOpen} onOpenChange={setDropOpen}>
                      <PopoverTrigger asChild>
                        <button
                          className="ss-inp"
                          style={{
                            textAlign: "left",
                            cursor: "pointer",
                            color: dropDate ? "#0f172a" : "#94a3b8",
                            fontWeight: dropDate ? 700 : 500,
                          }}
                        >
                          {dropDate
                            ? format(dropDate, "MMM d, yyyy")
                            : "Select date"}
                        </button>
                      </PopoverTrigger>

                      <PopoverContent
                        className="w-auto p-0"
                        align="start"
                        style={{ zIndex: 200 }}
                      >
                        <Calendar
                          mode="single"
                          selected={dropDate}
                          onSelect={handleDropDateSelect}
                          disabled={(date) => isBefore(date, today)}
                          autoFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#475569",
                        display: "block",
                        marginBottom: 6,
                        textTransform: "uppercase",
                        letterSpacing: ".7px",
                      }}
                    >
                      Deliver By
                    </label>

                    <Popover open={delivOpen} onOpenChange={setDelivOpen}>
                      <PopoverTrigger asChild>
                        <button
                          className="ss-inp"
                          style={{
                            textAlign: "left",
                            cursor: "pointer",
                            color: delivDate ? "#0f172a" : "#94a3b8",
                            fontWeight: delivDate ? 700 : 500,
                          }}
                        >
                          {delivDate
                            ? format(delivDate, "MMM d, yyyy")
                            : "Select date"}
                        </button>
                      </PopoverTrigger>

                      <PopoverContent
                        className="w-auto p-0"
                        align="start"
                        style={{ zIndex: 200 }}
                      >
                        <Calendar
                          mode="single"
                          selected={delivDate}
                          onSelect={handleDelivDateSelect}
                          disabled={(date) => isBefore(date, dropDate || today)}
                          autoFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {dropDate && delivDate && !completedSections.has("dates") && (
                  <button
                    className="ss-btn ss-btn-primary"
                    style={{
                      marginTop: 16,
                      width: "100%",
                      padding: "10px 0",
                      fontSize: 13,
                    }}
                    onClick={() => completeDates(dropDate, delivDate)}
                  >
                    Continue with these dates
                  </button>
                )}
              </div>
            ) : (
              <div
                style={{
                  padding: "14px 18px",
                  color: "#64748b",
                  cursor: "pointer",
                }}
                onClick={() => handleSectionClick("dates")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StepNum n="2" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Dates</span>
                  <span style={{ marginLeft: "auto", fontSize: 12 }}>→</span>
                </div>
              </div>
            )}
          </div>
        )}

        {estimateStage === "dates" && (
          <EstimateStrip label="Based on route & delivery window" />
        )}

        {/* SHIPPING DETAILS */}
        {showDetails && (
          <div
            className="ss-card"
            style={{ animation: "fadeUp .3s both", transition: "all 0.3s ease" }}
          >
            {completedSections.has("details") && activeSection !== "details" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px",
                  cursor: "pointer",
                }}
                onClick={() => handleSectionClick("details")}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: "#2563EB",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </div>

                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#0f172a",
                    }}
                  >
                    {shipmentDetailsSummary}
                  </span>
                </div>

                <button
                  className="ss-btn ss-btn-outline ss-btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditDetails();
                  }}
                >
                  Edit
                </button>
              </div>
            ) : activeSection === "details" ? (
              <div style={{ padding: "20px", animation: "fadeIn .2s both" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  <StepNum n="3" />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#0f172a",
                    }}
                  >
                    Shipping Details
                  </span>
                </div>

                {packages.map((pkg, i) => {
                  const errs = showErr ? getItemErrors(pkg) : [];

                  return (
                    <div
                      key={i}
                      className={`ss-pkg-item ${errs.length ? "err" : ""}`}
                      style={{
                        animationDelay: `${i * 0.05}s`,
                        borderColor: errs.length ? "#fecaca" : "#dbe3ef",
                        background: "#ffffff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 14,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: "#0f172a",
                          }}
                        >
                          Item {i + 1}
                        </span>

                        {packages.length > 1 && (
                          <button
                            onClick={() => rmPkg(i)}
                            style={{
                              padding: "3px 10px",
                              borderRadius: 6,
                              border: "1px solid #fecaca",
                              background: "#fef2f2",
                              color: "#dc2626",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <label
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: "#475569",
                            display: "block",
                            marginBottom: 8,
                            textTransform: "uppercase",
                            letterSpacing: ".7px",
                          }}
                        >
                          Type of Packaging
                        </label>

                        <PackageTypeDropdown
                          value={pkg.type}
                          onChange={(nextType) => upPkg(i, "type", nextType)}
                        />
                      </div>

                      <div style={{ marginTop: 16, marginBottom: 16 }}>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "72px 96px 1fr",
                            gap: 12,
                            alignItems: "end",
                          }}
                        >
                          <NumberField
                            label="Qty"
                            value={pkg.qty}
                            min={1}
                            step={1}
                            placeholder="1"
                            error={
                              showErr &&
                              (!pkg.qty || parseInt(pkg.qty, 10) < 1)
                            }
                            onChange={(value) => upPkg(i, "qty", value)}
                          />

                          <NumberField
                            label="Weight"
                            sublabel="lbs"
                            value={pkg.weight}
                            min={0.1}
                            step={0.1}
                            placeholder="0"
                            error={
                              showErr &&
                              (!pkg.weight || parseFloat(pkg.weight) <= 0)
                            }
                            onChange={(value) => upPkg(i, "weight", value)}
                          />

                          <div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "baseline",
                                justifyContent: "space-between",
                                marginBottom: 6,
                              }}
                            >
                              <label
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: "#475569",
                                  textTransform: "uppercase",
                                  letterSpacing: ".7px",
                                }}
                              >
                                Dimensions
                              </label>

                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: "#94a3b8",
                                }}
                              >
                                inches
                              </span>
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "1fr 12px 1fr 12px 1fr",
                                gap: 6,
                                alignItems: "center",
                              }}
                            >
                              <input
                                className={`ss-sn ${
                                  showErr &&
                                  (!pkg.l || parseFloat(pkg.l) <= 0)
                                    ? "err"
                                    : ""
                                }`}
                                type="number"
                                min="0.1"
                                step="0.1"
                                placeholder="L"
                                value={pkg.l}
                                onChange={(e) =>
                                  upPkg(i, "l", e.target.value)
                                }
                                style={{
                                  width: "100%",
                                  height: 44,
                                  fontSize: 14,
                                  fontWeight: 800,
                                  color: "#0f172a",
                                  borderColor:
                                    showErr &&
                                    (!pkg.l || parseFloat(pkg.l) <= 0)
                                      ? "#ef4444"
                                      : "#dbe3ef",
                                }}
                              />

                              <span
                                style={{
                                  color: "#94a3b8",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  textAlign: "center",
                                }}
                              >
                                ×
                              </span>

                              <input
                                className={`ss-sn ${
                                  showErr &&
                                  (!pkg.w || parseFloat(pkg.w) <= 0)
                                    ? "err"
                                    : ""
                                }`}
                                type="number"
                                min="0.1"
                                step="0.1"
                                placeholder="W"
                                value={pkg.w}
                                onChange={(e) =>
                                  upPkg(i, "w", e.target.value)
                                }
                                style={{
                                  width: "100%",
                                  height: 44,
                                  fontSize: 14,
                                  fontWeight: 800,
                                  color: "#0f172a",
                                  borderColor:
                                    showErr &&
                                    (!pkg.w || parseFloat(pkg.w) <= 0)
                                      ? "#ef4444"
                                      : "#dbe3ef",
                                }}
                              />

                              <span
                                style={{
                                  color: "#94a3b8",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  textAlign: "center",
                                }}
                              >
                                ×
                              </span>

                              <input
                                className={`ss-sn ${
                                  showErr &&
                                  (!pkg.h || parseFloat(pkg.h) <= 0)
                                    ? "err"
                                    : ""
                                }`}
                                type="number"
                                min="0.1"
                                step="0.1"
                                placeholder="H"
                                value={pkg.h}
                                onChange={(e) =>
                                  upPkg(i, "h", e.target.value)
                                }
                                style={{
                                  width: "100%",
                                  height: 44,
                                  fontSize: 14,
                                  fontWeight: 800,
                                  color: "#0f172a",
                                  borderColor:
                                    showErr &&
                                    (!pkg.h || parseFloat(pkg.h) <= 0)
                                      ? "#ef4444"
                                      : "#dbe3ef",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <label
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: "#475569",
                            display: "block",
                            marginBottom: 8,
                            textTransform: "uppercase",
                            letterSpacing: ".7px",
                          }}
                        >
                          Special handling
                        </label>

                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {HANDLING.filter((h) => h.id !== "standard").map(
                            (h) => {
                              const selected = pkg.handling === h.id;

                              return (
                                <button
                                  key={h.id}
                                  className={`ss-sel-h ${
                                    selected ? "on" : ""
                                  }`}
                                  onClick={() =>
                                    upPkg(
                                      i,
                                      "handling",
                                      selected ? "standard" : h.id,
                                    )
                                  }
                                  style={{
                                    fontWeight: selected ? 800 : 700,
                                    color: selected ? "#1d4ed8" : "#334155",
                                  }}
                                >
                                  {h.label}
                                </button>
                              );
                            },
                          )}
                        </div>

                        {pkg.handling === "standard" && (
                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 12,
                              color: "#64748b",
                              lineHeight: 1.4,
                            }}
                          >
                            Standard handling will be used unless you select an
                            option.
                          </div>
                        )}
                      </div>

                      {errs.length > 0 && (
                        <div
                          style={{
                            marginTop: 12,
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                          }}
                        >
                          {errs.map((e, ei) => (
                            <div
                              key={ei}
                              style={{
                                fontSize: 12,
                                color: "#dc2626",
                                fontWeight: 700,
                              }}
                            >
                              ⚠ {e}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                <button className="ss-add-btn" onClick={addPkg}>
                  <span style={{ fontSize: 20 }}>+</span> Add Another Item
                </button>

                <div
                  style={{
                    marginTop: 20,
                    borderTop: "1px solid #e5e7eb",
                    paddingTop: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      color: "#0f172a",
                      marginBottom: 12,
                      fontWeight: 800,
                    }}
                  >
                    What matters most for this shipment?
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(["ontime", "damage", "price", "speed"] as const).map(
                      (p) => (
                        <button
                          key={p}
                          style={{
                            fontSize: 13,
                            padding: "8px 16px",
                            borderRadius: 8,
                            border:
                              shipmentPriority === p
                                ? "1px solid #2563EB"
                                : "1px solid #dbe3ef",
                            background:
                              shipmentPriority === p ? "#2563EB" : "#ffffff",
                            color: shipmentPriority === p ? "white" : "#334155",
                            cursor: "pointer",
                            fontWeight: shipmentPriority === p ? 800 : 700,
                            fontFamily: "inherit",
                            transition: "all 0.2s ease",
                          }}
                          onClick={() => setShipmentPriority(p)}
                        >
                          {PRIORITY_LABELS[p]}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: "14px 18px",
                  color: "#64748b",
                  cursor: "pointer",
                }}
                onClick={() => handleSectionClick("details")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StepNum n="3" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    Shipping Details
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 12 }}>→</span>
                </div>
              </div>
            )}
          </div>
        )}

        {showFinalCTA && (
          <>
            {estimateStage === "details" && (
              <EstimateStrip label="Based on route, dates & package details" />
            )}

            <button
              className="ss-btn ss-btn-primary"
              style={{ marginTop: 12, marginBottom: 20, width: "100%" }}
              onClick={handleSearch}
            >
              {ctaLabel}
            </button>
          </>
        )}

        {/* RESULTS */}
                {/* RESULTS */}
        {resultsLoaded && (
          <div ref={res} style={{ padding: "8px 0 80px" }}>
            {loading && !data && <LoadingSkeleton />}

            {data && (
              <div
                style={{
                  animation: "fadeIn .3s both",
                  opacity: loading ? 0.45 : 1,
                  pointerEvents: loading ? "none" : "auto",
                  transition: "opacity 0.25s ease",
                }}
              >
                {data.prime && (
                  <Section
                    icon={"🏢"}
                    title="Major Carriers"
                    subtitle="UPS, FedEx, DHL and other national carriers"
                    badge={{ bg: "#eff6ff", c: "#1d4ed8", label: "VERIFIED" }}
                    topRows={data.prime.top ?? []}
                    moreRows={data.prime.more ?? []}
                    openId={openId}
                    onToggle={toggle}
                    animBase={0.1}
                    buildUrl={bUrl}
                    savedIds={
                      new Set(
                        (data.prime.top ?? [])
                          .concat(data.prime.more ?? [])
                          .filter((s) => isServiceSaved(s))
                          .map((s) => s.id),
                      )
                    }
                    onSaveService={handleSaveWithAuth}
                    origin={origin}
                    dest={dest}
                  />
                )}

                {data.private && (
                  <Section
                    icon={"🚀"}
                    title="Specialty Shippers"
                    subtitle="Luggage and personal-item shipping services"
                    badge={{ bg: "#f0fdf4", c: "#15803d", label: "SPECIALTY" }}
                    topRows={data.private.top ?? []}
                    moreRows={data.private.more ?? []}
                    openId={openId}
                    onToggle={toggle}
                    animBase={0.3}
                    buildUrl={bUrl}
                    savedIds={
                      new Set(
                        (data.private.top ?? [])
                          .concat(data.private.more ?? [])
                          .filter((s) => isServiceSaved(s))
                          .map((s) => s.id),
                      )
                    }
                    onSaveService={handleSaveWithAuth}
                    origin={origin}
                    dest={dest}
                  />
                )}

                {(() => {
                  const allServices = [
                    ...(data.prime?.top ?? []),
                    ...(data.prime?.more ?? []),
                    ...(data.private?.top ?? []),
                    ...(data.private?.more ?? []),
                  ];

                  if (allServices.length === 0) {
                    return null;
                  }

                  const allOptions = allServices.map(serviceToCompareOption);

                  return (
                    <>
                      {allOptions.length >= 2 && (
                        <CompareSection
                          shipment={{
                            item_description: pkgSummary,
                            origin_zip: origin,
                            destination_zip: dest,
                            deadline_date: delivDateStr,
                            weight_lb: tw,
                          }}
                          allOptions={allOptions}
                          selectedPriority={shipmentPriority}
                        />
                      )}

                      <FloatingShipmentAdvisor
                        context={{
                          origin_zip: origin || undefined,
                          destination_zip: dest || undefined,
                          weight_lbs: tw || undefined,
                          drop_off_date: dropDateStr || undefined,
                          expected_delivery_date: delivDateStr || undefined,
                        }}
                        options={allOptions}
                        selectedPriority={shipmentPriority}
                      />
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        <SaveSignInModal
          open={signInModalOpen}
          onOpenChange={setSignInModalOpen}
          onSignInComplete={handleSignInComplete}
        />
      </div>
        </section>


    </div>
  );
}

export default function HomePage(props: HomePageProps) {
  return (
    <ShipmentDraftProvider>
      <HomePageInner {...props} />
    </ShipmentDraftProvider>
  );
}
