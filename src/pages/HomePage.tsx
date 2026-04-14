// TODO: [MIGRATION] This page uses useShippingQuotes which calls the legacy
// "get-shipping-quotes" Supabase edge function. Migrate to Java/Python API
// per docs/service-boundaries.md when backend is ready.

import { useState, useRef, useEffect, useCallback } from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { CityInput } from "@/components/shipping/CityInput";
import { StepNum } from "@/components/shipping/SharedUI";
import { Section } from "@/components/shipping/QuoteRow";
import { CompareSection } from "@/components/shipping/CompareSection";
import { PKG_TYPES, HANDLING, getItemErrors, buildBookUrl, type PackageItem, type ShippingService } from "@/lib/shipping-data";
import { type CompareOption, type Priority } from "@/components/shipping/compare.types";
import { buildSnapshotKey } from "@/hooks/useSavedOptions";
import { useShippingQuotes } from "@/hooks/useShippingQuotes";
import { useAuth } from "@/contexts/AuthContext";
import { SaveSignInModal } from "@/components/auth/SaveSignInModal";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface HomePageProps {
  savedIds: Set<string>;
  onSaveService: (svc: ShippingService, context: { origin: string; dest: string; dropDate: string; delivDate: string; pkgSummary: string; bookUrl: string }) => void;
}

const LoadingSkeleton = () => (
  <div style={{ padding: "20px 0" }}>
    {[1, 2].map(s => (
      <div key={s} style={{ marginBottom: 20 }}>
        <div className="shim" style={{ width: 180, height: 16, borderRadius: 8, marginBottom: 10 }} />
        <div style={{ borderRadius: 14, overflow: "hidden", border: "1.5px solid #eeeff1" }}>
          {[1, 2, 3].map(r => (
            <div key={r} style={{ padding: "16px 18px", borderBottom: "1px solid #f0f0f2", display: "flex", alignItems: "center", gap: 14 }}>
              <div className="shim" style={{ width: 32, height: 32, borderRadius: 8 }} />
              <div style={{ flex: 1 }}>
                <div className="shim" style={{ width: "60%", height: 14, borderRadius: 6, marginBottom: 6 }} />
                <div className="shim" style={{ width: "40%", height: 10, borderRadius: 5 }} />
              </div>
              <div className="shim" style={{ width: 60, height: 20, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

function serviceToCompareOption(svc: ShippingService): CompareOption {
  const carrierType = ["UPS", "FedEx", "DHL"].includes(svc.carrier) ? "private" : "public";
  const now = new Date();
  const arrivalMs = now.getTime() + svc.transitDays * 86400000;
  const arrivalDate = new Date(arrivalMs).toISOString().split("T")[0];
  return {
    id: svc.id, carrier: svc.carrier, service_name: svc.name,
    carrier_type: carrierType, price_usd: svc.price,
    arrival_date: arrivalDate, arrival_label: svc.date,
    transit_days: svc.transitDays, guaranteed: svc.guaranteed,
  };
}

const PRIORITY_LABELS: Record<Priority, string> = {
  ontime: "On-time delivery",
  damage: "Damage protection",
  price: "Lowest price",
  speed: "Earliest arrival",
};

const today = startOfDay(new Date());

const EstimateStrip = ({ label }: { label: string }) => (
  <div style={{ marginTop: 12, marginBottom: 4, padding: "14px 16px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", animation: "fadeIn .3s both" }}>
    <div style={{ fontSize: 13, color: "#6b7280" }}>
      <span style={{ fontWeight: 600, color: "#111827" }}>Starting at $42–$125</span> {label}
    </div>
  </div>
);

type SectionId = 'location' | 'dates' | 'details';
type EstimateStage = SectionId | null;

export default function HomePage({ savedIds, onSaveService }: HomePageProps) {
  const { user } = useAuth();

  // ── FORM DATA ──
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [dropDate, setDropDate] = useState<Date | undefined>();
  const [delivDate, setDelivDate] = useState<Date | undefined>();
  const [dropOpen, setDropOpen] = useState(false);
  const [delivOpen, setDelivOpen] = useState(false);
  const [packages, setPackages] = useState<PackageItem[]>([{ type: "luggage", qty: "1", weight: "", l: "", w: "", h: "", handling: "standard" }]);
  const [showErr, setShowErr] = useState(false);
  const [shipmentPriority, setShipmentPriority] = useState<Priority>("ontime");

  // ── WIZARD STATE ──
  const [activeSection, setActiveSection] = useState<SectionId>('location');
  const [completedSections, setCompletedSections] = useState<Set<SectionId>>(new Set());
  // revealedSections: monotonically growing. Once shown, never hidden.
  const [revealedSections, setRevealedSections] = useState<Set<SectionId>>(new Set(['location']));
  const [estimateStage, setEstimateStage] = useState<EstimateStage>(null);

  // Location commit flags — set only by CityInput onSelect
  const [originCommitted, setOriginCommitted] = useState(false);
  const [destCommitted, setDestCommitted] = useState(false);

  // Results
  const [resultsLoaded, setResultsLoaded] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [pendingSaveService, setPendingSaveService] = useState<ShippingService | null>(null);

  const { loading, data, fetchQuotes } = useShippingQuotes();
  const res = useRef<HTMLDivElement>(null);
  const destRef = useRef<HTMLInputElement>(null);

  const dropDateStr = dropDate ? format(dropDate, "yyyy-MM-dd") : "";
  const delivDateStr = delivDate ? format(delivDate, "yyyy-MM-dd") : "";

  const tw = packages.reduce((a, p) => a + (parseFloat(p.weight) || 0) * (parseInt(p.qty) || 1), 0);
  const ti = packages.reduce((a, p) => a + (parseInt(p.qty) || 1), 0);
  const allValid = packages.every(p => p.weight && parseFloat(p.weight) > 0 && p.l && p.w && p.h && p.qty && parseInt(p.qty) >= 1);

  // ────────────────────────────────────────────────────────────
  // CORE FIX: All progression is event-driven, never useEffect-driven.
  //
  // completeLocation() is called from CityInput onSelect callbacks
  //   — only when BOTH origin and dest are committed.
  // completeDates() is called from Calendar onSelect callbacks
  //   — only when both dates are valid.
  //
  // Both functions chain forward: if downstream data is already valid
  // from a previous fill, they cascade immediately so the user is never
  // left on a section that's already done.
  // ────────────────────────────────────────────────────────────

  const completeLocation = useCallback(() => {
    setCompletedSections(prev => new Set([...prev, 'location']));
    setRevealedSections(prev => new Set([...prev, 'dates']));
    setEstimateStage('location');
    if (resultsLoaded) setNeedsRefresh(true);
    // Chain: if dates are already valid, skip straight through
    setActiveSection('dates');
  }, [resultsLoaded]);

  const completeDates = useCallback((currentDropDate: Date | undefined, currentDelivDate: Date | undefined) => {
    if (!currentDropDate || !currentDelivDate) return;
    setCompletedSections(prev => new Set([...prev, 'dates']));
    setRevealedSections(prev => new Set([...prev, 'details']));
    setEstimateStage('dates');
    if (resultsLoaded) setNeedsRefresh(true);
    setActiveSection('details');
  }, [resultsLoaded]);

  // Guard: clear deliver-by if it's before drop-off
  useEffect(() => {
    if (dropDate && delivDate && isBefore(delivDate, dropDate)) {
      setDelivDate(undefined);
    }
  }, [dropDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chaining effect removed — it auto-completed dates in 80ms, defeating
  // edit-dates and causing dead-end states. Now a "Continue" button handles
  // the case where dates are already pre-filled from a prior edit.

  // ── EDIT HANDLERS ──

  const handleEditLocation = useCallback(() => {
    setActiveSection('location');
    setOriginCommitted(false);
    setDestCommitted(false);
    setCompletedSections(new Set()); // un-complete all; revealedSections untouched
    setEstimateStage(null);
    if (resultsLoaded) setNeedsRefresh(true);
  }, [resultsLoaded]);

  const handleEditDates = useCallback(() => {
    setActiveSection('dates');
    setCompletedSections(prev => {
      const updated = new Set(prev);
      // Ensure location stays completed — editing dates must never drop it
      if (originCommitted && destCommitted && origin && dest) {
        updated.add('location');
      }
      updated.delete('dates');
      updated.delete('details');
      return updated;
    });
    setEstimateStage('location');
    if (resultsLoaded) setNeedsRefresh(true);
  }, [resultsLoaded, originCommitted, destCommitted, origin, dest]);

  const handleEditDetails = useCallback(() => {
    setActiveSection('details');
    setCompletedSections(prev => {
      const updated = new Set(prev);
      // Ensure location + dates stay completed
      if (originCommitted && destCommitted && origin && dest) {
        updated.add('location');
      }
      if (dropDate && delivDate) {
        updated.add('dates');
      }
      updated.delete('details');
      return updated;
    });
    setEstimateStage('dates');
    if (resultsLoaded) setNeedsRefresh(true);
  }, [resultsLoaded, originCommitted, destCommitted, origin, dest, dropDate, delivDate]);

  // ── CLICK COLLAPSED/WAITING SECTION → reopen it ──
  const handleSectionClick = useCallback((section: SectionId) => {
    if (section === 'location') handleEditLocation();
    else if (section === 'dates') handleEditDates();
    else handleEditDetails();
  }, [handleEditLocation, handleEditDates, handleEditDetails]);

  // ── SEARCH ──
  const handleSearch = useCallback(() => {
    if (!allValid) { setShowErr(true); return; }
    setShowErr(false);
    if (!completedSections.has('details')) {
      setCompletedSections(prev => new Set([...prev, 'details']));
    }
    setEstimateStage('details');
    setResultsLoaded(true);
    setNeedsRefresh(false);
    setOpenId(null);
    setTimeout(() => res.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    fetchQuotes(origin, dest, dropDateStr, delivDateStr, packages);
  }, [allValid, origin, dest, dropDateStr, delivDateStr, packages, fetchQuotes, completedSections]);

  // ── AUTH / SAVE ──
  const handleSaveWithAuth = (svc: ShippingService) => {
    if (!user) { setPendingSaveService(svc); setSignInModalOpen(true); }
    else { onSaveService(svc, { origin, dest, dropDate: dropDateStr, delivDate: delivDateStr, pkgSummary, bookUrl: bUrl(svc) }); }
  };
  const handleSignInComplete = () => {
    if (pendingSaveService) {
      onSaveService(pendingSaveService, { origin, dest, dropDate: dropDateStr, delivDate: delivDateStr, pkgSummary, bookUrl: bUrl(pendingSaveService) });
      setPendingSaveService(null);
    }
  };

  // ── PKG HELPERS ──
  const addPkg = () => setPackages([...packages, { type: "boxes", qty: "1", weight: "", l: "", w: "", h: "", handling: "standard" }]);
  const rmPkg = (i: number) => { if (packages.length > 1) setPackages(packages.filter((_, idx) => idx !== i)); };
  const upPkg = (i: number, f: string, v: string) => {
    if (["qty", "weight", "l", "w", "h"].includes(f)) { if (v !== "" && parseFloat(v) < 0) return; }
    setPackages(packages.map((p, idx) => idx === i ? { ...p, [f]: v } : p));
  };

  const toggle = (id: string) => setOpenId(openId === id ? null : id);
  const bUrl = (svc: ShippingService) => buildBookUrl(svc, origin, dest, dropDateStr, delivDateStr, packages);
  const pkgSummary = `${ti} pkg${ti > 1 ? "s" : ""} \u00B7 ${tw} lbs`;
  const isServiceSaved = (svc: ShippingService) => {
    const key = buildSnapshotKey(svc.id, origin, dest, dropDateStr, delivDateStr);
    return savedIds.has(key);
  };

  // ── DERIVED ──
  const showFinalCTA = (activeSection === 'details' && allValid) ||
    (completedSections.has('location') && completedSections.has('dates') && completedSections.has('details'));
  const ctaLabel = resultsLoaded ? "Update your search" : "Find best shipping options";
  const showDates = revealedSections.has('dates');
  const showDetails = revealedSections.has('details');

  // ── CityInput onSelect handlers ──
  // These are the ONLY place Location completion can fire.
  // Each one checks whether BOTH sides are now committed and, if so,
  // calls completeLocation() synchronously — no useEffect needed.

  const handleOriginSelect = useCallback((city: string) => {
    setOrigin(city);
    setOriginCommitted(true);
    // If dest is already committed, complete location now
    if (destCommitted) {
      completeLocation();
    } else {
      setTimeout(() => destRef.current?.focus(), 50);
    }
  }, [destCommitted, completeLocation]);

  const handleDestSelect = useCallback((city: string) => {
    setDest(city);
    setDestCommitted(true);
    // If origin is already committed, complete location now
    if (originCommitted) {
      completeLocation();
    }
  }, [originCommitted, completeLocation]);

  // ── Calendar onSelect handlers ──
  // Dates auto-complete the moment BOTH dates are chosen.

  const handleDropDateSelect = useCallback((d: Date | undefined) => {
    setDropDate(d);
    setDropOpen(false);
    if (d && delivDate && !isBefore(delivDate, d)) {
      // Both dates now valid — complete dates
      completeDates(d, delivDate);
    } else if (!delivDate) {
      setTimeout(() => setDelivOpen(true), 150);
    }
  }, [delivDate, completeDates]);

  const handleDelivDateSelect = useCallback((d: Date | undefined) => {
    setDelivDate(d);
    setDelivOpen(false);
    if (dropDate && d) {
      // Both dates now valid — complete dates
      completeDates(dropDate, d);
    }
  }, [dropDate, completeDates]);

  return (
    <div>
      {!resultsLoaded && (
        <div style={{ textAlign: "center", padding: "36px 20px 4px", animation: "fadeIn .5s both" }}>
          <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-1.4px" }}>Compare. Ship. Save.</h1>
          <p style={{ fontSize: 14, color: "#9ca3af", marginTop: 8 }}>UPS, FedEx, DHL & private shippers — one search.</p>
        </div>
      )}

      <div style={{ maxWidth: 780, margin: resultsLoaded ? "8px auto 0" : "20px auto 0", padding: "0 16px" }}>

        {/* ═══ SECTION 1: LOCATION ═══ */}
        <div className="ss-card" style={{ zIndex: 10, animation: "fadeUp .3s both", transition: "all 0.3s ease" }}>
          {completedSections.has('location') && activeSection !== 'location' ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer" }}
              onClick={() => handleSectionClick('location')}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: "#2563EB", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>✓</div>
                <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{origin} → {dest}</span>
              </div>
              <button className="ss-btn ss-btn-outline ss-btn-sm"
                onClick={(e) => { e.stopPropagation(); handleEditLocation(); }}>Edit</button>
            </div>
          ) : activeSection === 'location' ? (
            <div style={{ padding: "20px", animation: "fadeIn .2s both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <StepNum n="1" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Pickup & Delivery Location</span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <CityInput
                  value={origin} onChange={setOrigin}
                  onSelect={handleOriginSelect}
                  placeholder="From city or ZIP" icon={"\u25C9"}
                />
                <div onClick={() => { const t = origin; setOrigin(dest); setDest(t); }}
                  style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", cursor: "pointer", fontSize: 14, color: "#6b7280", flexShrink: 0, marginTop: 2, transition: "all 0.2s ease" }}
                  title="Swap">{"\u21C4"}</div>
                <CityInput
                  inputRef={destRef} value={dest} onChange={setDest}
                  onSelect={handleDestSelect}
                  placeholder="To city or ZIP" icon={"\u25CE"}
                />
              </div>
            </div>
          ) : (
            /* Waiting — Location is not active and not completed. Show collapsed row
               so it never disappears from the journey. */
            <div style={{ padding: "14px 18px", color: "#9ca3af", cursor: "pointer" }}
              onClick={() => handleSectionClick('location')}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <StepNum n="1" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {origin && dest ? `${origin} → ${dest}` : "Pickup & Delivery Location"}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 12 }}>{"\u2192"}</span>
              </div>
            </div>
          )}
        </div>

        {/* Estimate below Location */}
        {estimateStage === 'location' && <EstimateStrip label="Based on route" />}

        {/* ═══ SECTION 2: DATES ═══ */}
        {showDates && (
          <div className="ss-card" style={{ animation: "fadeUp .3s both", transition: "all 0.3s ease" }}>
            {completedSections.has('dates') && activeSection !== 'dates' ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer" }}
                onClick={() => handleSectionClick('dates')}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: "#2563EB", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>✓</div>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{dropDate ? format(dropDate, "MMM d, yyyy") : ""} → {delivDate ? format(delivDate, "MMM d, yyyy") : ""}</span>
                </div>
                <button className="ss-btn ss-btn-outline ss-btn-sm"
                  onClick={(e) => { e.stopPropagation(); handleEditDates(); }}>Edit</button>
              </div>
            ) : activeSection === 'dates' ? (
              <div style={{ padding: "20px", animation: "fadeIn .2s both" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <StepNum n="2" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Dates</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".8px" }}>Drop-off</label>
                    <Popover open={dropOpen} onOpenChange={setDropOpen}>
                      <PopoverTrigger asChild>
                        <button className="ss-inp" style={{ textAlign: "left", cursor: "pointer", color: dropDate ? "#111827" : "#b0b5c0" }}>
                          {dropDate ? format(dropDate, "MMM d, yyyy") : "Select date"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start" style={{ zIndex: 200 }}>
                        <Calendar mode="single" selected={dropDate}
                          onSelect={handleDropDateSelect}
                          disabled={(date) => isBefore(date, today)} autoFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".8px" }}>Deliver By</label>
                    <Popover open={delivOpen} onOpenChange={setDelivOpen}>
                      <PopoverTrigger asChild>
                        <button className="ss-inp" style={{ textAlign: "left", cursor: "pointer", color: delivDate ? "#111827" : "#b0b5c0" }}>
                          {delivDate ? format(delivDate, "MMM d, yyyy") : "Select date"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start" style={{ zIndex: 200 }}>
                        <Calendar mode="single" selected={delivDate}
                          onSelect={handleDelivDateSelect}
                          disabled={(date) => isBefore(date, dropDate || today)} autoFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                {/* Continue button when both dates are pre-filled from a previous edit */}
                {dropDate && delivDate && !completedSections.has('dates') && (
                  <button
                    className="ss-btn ss-btn-primary"
                    style={{ marginTop: 16, width: "100%", padding: "10px 0", fontSize: 13 }}
                    onClick={() => completeDates(dropDate, delivDate)}
                  >Continue with these dates</button>
                )}
              </div>
            ) : (
              /* Waiting — clickable so user is never stuck */
              <div style={{ padding: "14px 18px", color: "#9ca3af", cursor: "pointer" }}
                onClick={() => handleSectionClick('dates')}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StepNum n="2" />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Dates</span>
                  <span style={{ marginLeft: "auto", fontSize: 12 }}>→</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Estimate below Dates */}
        {estimateStage === 'dates' && <EstimateStrip label="Based on route & delivery window" />}

        {/* ═══ SECTION 3: SHIPPING DETAILS ═══ */}
        {showDetails && (
          <div className="ss-card" style={{ animation: "fadeUp .3s both", transition: "all 0.3s ease" }}>
            {completedSections.has('details') && activeSection !== 'details' ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer" }}
                onClick={() => handleSectionClick('details')}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: "#2563EB", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>✓</div>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{ti} item{ti > 1 ? "s" : ""} · {tw} lbs · {PRIORITY_LABELS[shipmentPriority]}</span>
                </div>
                <button className="ss-btn ss-btn-outline ss-btn-sm"
                  onClick={(e) => { e.stopPropagation(); handleEditDetails(); }}>Edit</button>
              </div>
            ) : activeSection === 'details' ? (
              <div style={{ padding: "20px", animation: "fadeIn .2s both" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <StepNum n="3" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Shipping Details</span>
                </div>

                {packages.map((pkg, i) => {
                  const errs = showErr ? getItemErrors(pkg) : [];
                  return (
                    <div key={i} className={`ss-pkg-item ${errs.length ? "err" : ""}`} style={{ animationDelay: `${i * 0.05}s` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Item {i + 1}</span>
                        {packages.length > 1 && <button onClick={() => rmPkg(i)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>}
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                        {PKG_TYPES.map(p => (
                          <div key={p.id} className={`ss-typ-c ${pkg.type === p.id ? "on" : ""}`} onClick={() => upPkg(i, "type", p.id)}>
                            <span style={{ fontSize: 14 }}>{p.icon}</span>{p.label}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 8 }}>
                        <div style={{ width: 56 }}>
                          <label style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", display: "block", marginBottom: 3, textTransform: "uppercase" }}>Qty</label>
                          <input className={`ss-sn ${showErr && (!pkg.qty || parseInt(pkg.qty) < 1) ? "err" : ""}`} style={{ width: "100%" }} type="number" min="1" placeholder="1" value={pkg.qty} onChange={e => upPkg(i, "qty", e.target.value)} />
                        </div>
                        <div style={{ width: 76 }}>
                          <label style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", display: "block", marginBottom: 3, textTransform: "uppercase" }}>Wt (lbs)</label>
                          <input className={`ss-sn ${showErr && !pkg.weight ? "err" : ""}`} style={{ width: "100%" }} placeholder="0" type="number" min="0" value={pkg.weight} onChange={e => upPkg(i, "weight", e.target.value)} />
                        </div>
                        <div style={{ display: "flex", gap: 3, alignItems: "flex-end" }}>
                          <div><label style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", display: "block", marginBottom: 3 }}>L</label><input className={`ss-sn ${showErr && !pkg.l ? "err" : ""}`} placeholder="" type="number" min="0" value={pkg.l} onChange={e => upPkg(i, "l", e.target.value)} /></div>
                          <span style={{ color: "#d1d5db", fontWeight: 700, fontSize: 11, marginBottom: 9 }}>{"\u00D7"}</span>
                          <div><label style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", display: "block", marginBottom: 3 }}>W</label><input className={`ss-sn ${showErr && !pkg.w ? "err" : ""}`} placeholder="" type="number" min="0" value={pkg.w} onChange={e => upPkg(i, "w", e.target.value)} /></div>
                          <span style={{ color: "#d1d5db", fontWeight: 700, fontSize: 11, marginBottom: 9 }}>{"\u00D7"}</span>
                          <div><label style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", display: "block", marginBottom: 3 }}>H</label><input className={`ss-sn ${showErr && !pkg.h ? "err" : ""}`} placeholder="" type="number" min="0" value={pkg.h} onChange={e => upPkg(i, "h", e.target.value)} /></div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {HANDLING.map(h => <button key={h.id} className={`ss-sel-h ${pkg.handling === h.id ? "on" : ""}`} onClick={() => upPkg(i, "handling", h.id)}>{h.label}</button>)}
                      </div>
                      {errs.length > 0 && (
                        <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca" }}>
                          {errs.map((e, ei) => <div key={ei} style={{ fontSize: 11, color: "#dc2626", fontWeight: 500 }}>{"\u26A0"} {e}</div>)}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button className="ss-add-btn" onClick={addPkg}><span style={{ fontSize: 20 }}>+</span> Add Another Item</button>

                {/* Priority selector */}
                <div style={{ marginTop: 20, borderTop: "1px solid #e5e7eb", paddingTop: 20 }}>
                  <div style={{ fontSize: 13, color: "#374151", marginBottom: 12, fontWeight: 500 }}>What matters most for this shipment?</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(["ontime", "damage", "price", "speed"] as const).map((p) => (
                      <button key={p}
                        style={{
                          fontSize: 13, padding: "8px 16px", borderRadius: 6,
                          border: shipmentPriority === p ? "1px solid #2563EB" : "1px solid #e5e7eb",
                          background: shipmentPriority === p ? "#2563EB" : "transparent",
                          color: shipmentPriority === p ? "white" : "#6b7280",
                          cursor: "pointer", fontWeight: shipmentPriority === p ? 600 : 500,
                          fontFamily: "inherit", transition: "all 0.2s ease",
                        }}
                        onClick={() => setShipmentPriority(p)}
                      >{PRIORITY_LABELS[p]}</button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Waiting — clickable */
              <div style={{ padding: "14px 18px", color: "#9ca3af", cursor: "pointer" }}
                onClick={() => handleSectionClick('details')}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StepNum n="3" />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Shipping Details</span>
                  <span style={{ marginLeft: "auto", fontSize: 12 }}>→</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Final estimate + single CTA ── */}
        {showFinalCTA && (
          <>
            {estimateStage === 'details' && <EstimateStrip label="Based on route, dates & package details" />}
            <button
              className="ss-btn ss-btn-primary"
              style={{ marginTop: 12, marginBottom: 20, width: "100%" }}
              onClick={handleSearch}
            >{ctaLabel}</button>
          </>
        )}

        {/* ═══ RESULTS ═══ */}
        {resultsLoaded && (
          <div ref={res} style={{ padding: "8px 0 80px" }}>
            {/* First load: no data yet → show skeleton */}
            {loading && !data && <LoadingSkeleton />}
            {/* Refresh: keep old data visible (dimmed) while loading new data */}
            {data && (
              <div style={{ animation: "fadeIn .3s both", opacity: loading ? 0.45 : 1, pointerEvents: loading ? "none" : "auto", transition: "opacity 0.25s ease" }}>
                {data.prime && (
                  <Section
                    icon={"\uD83C\uDFE2"} title="Prime Providers" subtitle="Major carriers with guaranteed service levels"
                    badge={{ bg: "#eff6ff", c: "#1d4ed8", label: "VERIFIED" }}
                    topRows={data.prime.top ?? []} moreRows={data.prime.more ?? []}
                    openId={openId} onToggle={toggle} animBase={0.1} buildUrl={bUrl}
                    savedIds={new Set((data.prime.top ?? []).concat(data.prime.more ?? []).filter(s => isServiceSaved(s)).map(s => s.id))}
                    onSaveService={handleSaveWithAuth} origin={origin} dest={dest}
                  />
                )}
                {data.private && (
                  <Section
                    icon={"\uD83D\uDE80"} title="Private Providers" subtitle="Specialized shippers for luggage & personal items"
                    badge={{ bg: "#f0fdf4", c: "#15803d", label: "SPECIALIST" }}
                    topRows={data.private.top ?? []} moreRows={data.private.more ?? []}
                    openId={openId} onToggle={toggle} animBase={0.3} buildUrl={bUrl}
                    savedIds={new Set((data.private.top ?? []).concat(data.private.more ?? []).filter(s => isServiceSaved(s)).map(s => s.id))}
                    onSaveService={handleSaveWithAuth} origin={origin} dest={dest}
                  />
                )}

                {(() => {
                  const allServices = [
                    ...(data.prime?.top ?? []), ...(data.prime?.more ?? []),
                    ...(data.private?.top ?? []), ...(data.private?.more ?? []),
                  ];
                  if (allServices.length >= 2) {
                    const allOptions = allServices.map(serviceToCompareOption);
                    return (
                      <CompareSection
                        shipment={{ item_description: pkgSummary, origin_zip: origin, destination_zip: dest, deadline_date: delivDateStr, weight_lb: tw }}
                        allOptions={allOptions}
                        selectedPriority={shipmentPriority}
                      />
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>
        )}

        <SaveSignInModal open={signInModalOpen} onOpenChange={setSignInModalOpen} onSignInComplete={handleSignInComplete} />
      </div>
    </div>
  );
}
