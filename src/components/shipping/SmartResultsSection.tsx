import { useMemo, useState } from "react";
import { Logo } from "@/components/shipping/Logo";
import { CompareSection } from "@/components/shipping/CompareSection";
import type { Priority } from "@/components/shipping/compare.types";
import type { ShippingService } from "@/lib/shipping-data";
import { supabase } from "@/integrations/supabase/client";
import { apiConfig, javaApi } from "@/config/api";
import FloatingShipmentAdvisor from "@/components/concierge/FloatingShipmentAdvisor";
import {
  formatMoney,
  isMajorCarrier,
  rankShippingServices,
  sortRankedServices,
  toCompareOption,
  type RankedShippingService,
  type SortMode,
} from "@/lib/shipping-recommendation";

interface QuoteGroup {
  top?: ShippingService[];
  more?: ShippingService[];
}

interface QuotesData {
  prime?: QuoteGroup;
  private?: QuoteGroup;
}

interface SmartResultsSectionProps {
  data: QuotesData;
  origin: string;
  dest: string;
  dropDateStr: string;
  delivDateStr: string;
  weightLbs: number;
  pkgSummary: string;
  selectedPriority: Priority;
  openId: string | null;
  onToggle: (id: string) => void;
  buildUrl: (svc: ShippingService) => string;
  isServiceSaved: (svc: ShippingService) => boolean;
  onSaveService: (svc: ShippingService) => void;
}

const sortLabels: Record<SortMode, string> = {
  recommended: "Best overall",
  cheapest: "Cheapest",
  fastest: "Fastest",
  guaranteed: "Guaranteed",
};

function getAllServices(data: QuotesData): ShippingService[] {
  return [
    ...(data.prime?.top ?? []),
    ...(data.prime?.more ?? []),
    ...(data.private?.top ?? []),
    ...(data.private?.more ?? []),
  ];
}

function trackBookingRedirect(
  service: ShippingService,
  bookUrl: string,
  origin: string,
  dest: string,
) {
  const payload = {
    serviceId: service.id,
    carrier: service.carrier,
    serviceName: service.name,
    redirectUrl: bookUrl,
    origin,
    destination: dest,
  };

  if (apiConfig.useJavaBookingRedirect) {
    fetch(javaApi.bookingRedirect(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } else {
    supabase.functions
      .invoke("generate-book-redirect", { body: payload })
      .catch(() => {});
  }
}

function RecommendationCard({
  best,
  buildUrl,
  origin,
  dest,
  onAsk,
}: {
  best: RankedShippingService;
  buildUrl: (svc: ShippingService) => string;
  origin: string;
  dest: string;
  onAsk: () => void;
}) {
  const bookUrl = buildUrl(best);

  return (
    <section
      style={{
        marginTop: 20,
        marginBottom: 18,
        borderRadius: 20,
        border: "1px solid #bfdbfe",
        background:
          "linear-gradient(135deg, rgba(239,246,255,0.98), rgba(255,255,255,0.98))",
        boxShadow: "0 18px 45px rgba(37, 99, 235, 0.10)",
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", gap: 14, minWidth: 0 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "#ffffff",
              border: "1px solid #dbeafe",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Logo name={best.carrier} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 999,
                background: "#2563eb",
                color: "white",
                padding: "5px 10px",
                fontSize: 11,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: ".7px",
                marginBottom: 10,
              }}
            >
              Recommended for this shipment
            </div>

            <h3
              style={{
                margin: 0,
                fontSize: 21,
                lineHeight: 1.15,
                letterSpacing: "-.4px",
                fontWeight: 900,
                color: "#0f172a",
              }}
            >
              {best.carrier} {best.name}
            </h3>

            <p
              style={{
                margin: "8px 0 0",
                fontSize: 14,
                color: "#334155",
                lineHeight: 1.45,
                maxWidth: 620,
              }}
            >
              {best.bestFor}
            </p>
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 950, color: "#0f172a" }}>
            {formatMoney(best.price)}
          </div>
          <div style={{ marginTop: 3, fontSize: 12, color: "#64748b" }}>
            {best.transitDays} day{best.transitDays === 1 ? "" : "s"} · {best.date}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginTop: 18,
        }}
      >
        <button
          type="button"
          onClick={() => {
            trackBookingRedirect(best, bookUrl, origin, dest);
            window.location.href = bookUrl;
          }}
          style={{
            border: 0,
            borderRadius: 12,
            background: "#2563eb",
            color: "white",
            padding: "11px 16px",
            fontSize: 13,
            fontWeight: 900,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Choose this option
        </button>

        <a
          href="#compare-options"
          style={{
            borderRadius: 12,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            padding: "10px 15px",
            fontSize: 13,
            fontWeight: 850,
            textDecoration: "none",
          }}
        >
          Compare options
        </a>

        <button
          type="button"
          onClick={onAsk}
          style={{
            borderRadius: 12,
            border: "1px solid #dbeafe",
            background: "#eff6ff",
            color: "#1d4ed8",
            padding: "10px 15px",
            fontSize: 13,
            fontWeight: 850,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Ask why
        </button>
      </div>
    </section>
  );
}

function ResultsToolbar({
  sortMode,
  setSortMode,
  guaranteedOnly,
  setGuaranteedOnly,
}: {
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  guaranteedOnly: boolean;
  setGuaranteedOnly: (value: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 12,
      }}
    >
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-.3px",
          }}
        >
          Ranked shipping options
        </h3>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
          Ranked by your shipment priority. AI can explain the tradeoffs, but ranking stays deterministic.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setSortMode(mode)}
            style={{
              borderRadius: 999,
              border: sortMode === mode ? "1px solid #2563eb" : "1px solid #e2e8f0",
              background: sortMode === mode ? "#2563eb" : "#ffffff",
              color: sortMode === mode ? "#ffffff" : "#475569",
              padding: "7px 11px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {sortLabels[mode]}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setGuaranteedOnly(!guaranteedOnly)}
          style={{
            borderRadius: 999,
            border: guaranteedOnly ? "1px solid #16a34a" : "1px solid #e2e8f0",
            background: guaranteedOnly ? "#dcfce7" : "#ffffff",
            color: guaranteedOnly ? "#166534" : "#475569",
            padding: "7px 11px",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Guaranteed only
        </button>
      </div>
    </div>
  );
}

function RankedQuoteRow({
  service,
  bookUrl,
  isSaved,
  isOpen,
  onToggle,
  onSave,
  origin,
  dest,
}: {
  service: RankedShippingService;
  bookUrl: string;
  isSaved: boolean;
  isOpen: boolean;
  onToggle: (id: string) => void;
  onSave: (svc: ShippingService) => void;
  origin: string;
  dest: string;
}) {
  return (
    <div
      style={{
        borderTop: "1px solid #eef2f7",
        background: service.isBest ? "#f8fbff" : "#ffffff",
      }}
    >
      <div
        onClick={() => onToggle(service.id)}
        style={{
          display: "grid",
          gridTemplateColumns: "54px minmax(0,1fr) 92px 96px 116px 124px",
          alignItems: "center",
          gap: 12,
          padding: "15px 18px",
          cursor: "pointer",
        }}
      >
        <div style={{ position: "relative" }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Logo name={service.carrier} />
          </div>
          <div
            style={{
              position: "absolute",
              right: 2,
              top: -8,
              minWidth: 22,
              height: 22,
              borderRadius: 999,
              background: service.isBest ? "#2563eb" : "#e2e8f0",
              color: service.isBest ? "white" : "#334155",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 950,
              border: "2px solid white",
            }}
          >
            {service.rank}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 900,
                color: "#0f172a",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {service.carrier} {service.name}
            </div>
            <span
              style={{
                borderRadius: 999,
                background: service.isBest ? "#dbeafe" : "#f1f5f9",
                color: service.isBest ? "#1d4ed8" : "#475569",
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: ".5px",
              }}
            >
              {service.rankLabel}
            </span>
          </div>

          <div style={{ marginTop: 5, fontSize: 12, lineHeight: 1.4, color: "#64748b" }}>
            {service.bestFor}
          </div>

          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {service.guaranteed && (
              <span style={{ fontSize: 11, fontWeight: 800, color: "#166534" }}>
                ✓ Guaranteed
              </span>
            )}
            {service.promo && (
              <span style={{ fontSize: 11, fontWeight: 800, color: "#b45309" }}>
                {service.promo.pct}% off
              </span>
            )}
            {service.tier && (
              <span style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>
                {service.tier}
              </span>
            )}
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
            {service.transitDays}d
          </div>
          <div style={{ marginTop: 3, fontSize: 11, color: "#64748b" }}>{service.date}</div>
        </div>

        <div style={{ textAlign: "center" }}>
          <span
            style={{
              borderRadius: 999,
              background: service.guaranteed ? "#dcfce7" : "#f1f5f9",
              color: service.guaranteed ? "#166534" : "#475569",
              padding: "5px 9px",
              fontSize: 11,
              fontWeight: 850,
            }}
          >
            {service.guaranteed ? "Guaranteed" : "Standard"}
          </span>
        </div>

        <div style={{ textAlign: "right" }}>
          {service.originalPrice && (
            <div style={{ fontSize: 11, color: "#94a3b8", textDecoration: "line-through" }}>
              {formatMoney(service.originalPrice)}
            </div>
          )}
          <div style={{ fontSize: 17, fontWeight: 950, color: "#0f172a" }}>
            {formatMoney(service.price)}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSave(service);
            }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: isSaved ? "#eff6ff" : "white",
              color: isSaved ? "#2563eb" : "#64748b",
              cursor: "pointer",
              fontWeight: 900,
              fontFamily: "inherit",
            }}
            title={isSaved ? "Saved" : "Save"}
          >
            {isSaved ? "✓" : "☆"}
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              trackBookingRedirect(service, bookUrl, origin, dest);
              window.location.href = bookUrl;
            }}
            style={{
              border: 0,
              borderRadius: 10,
              background: service.isBest ? "#2563eb" : "#0f172a",
              color: "white",
              padding: "9px 12px",
              fontSize: 12,
              fontWeight: 900,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Select
          </button>
        </div>
      </div>

      {isOpen && (
        <div style={{ padding: "0 18px 16px 84px" }}>
          <div
            style={{
              borderRadius: 14,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              padding: 14,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>
              Details
            </div>

            {service.ai && (
              <div style={{ marginBottom: 10, fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
                {service.ai}
              </div>
            )}

            {Object.keys(service.details ?? {}).length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                {Object.entries(service.details).map(([key, value]) => (
                  <div key={key} style={{ fontSize: 12 }}>
                    <span style={{ color: "#64748b", fontWeight: 750 }}>{key}: </span>
                    <span style={{ color: "#0f172a", fontWeight: 800 }}>{value}</span>
                  </div>
                ))}
              </div>
            )}

            {service.features?.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {service.features.map((feature) => (
                  <span
                    key={feature}
                    style={{
                      borderRadius: 999,
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      padding: "5px 8px",
                      fontSize: 11,
                      fontWeight: 750,
                      color: "#475569",
                    }}
                  >
                    {feature}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderGroup({
  title,
  subtitle,
  services,
  openId,
  onToggle,
  buildUrl,
  isServiceSaved,
  onSaveService,
  origin,
  dest,
}: {
  title: string;
  subtitle: string;
  services: RankedShippingService[];
  openId: string | null;
  onToggle: (id: string) => void;
  buildUrl: (svc: ShippingService) => string;
  isServiceSaved: (svc: ShippingService) => boolean;
  onSaveService: (svc: ShippingService) => void;
  origin: string;
  dest: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? services : services.slice(0, 4);
  const hiddenCount = Math.max(services.length - visible.length, 0);

  if (services.length === 0) return null;

  return (
    <section
      style={{
        borderRadius: 18,
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        overflow: "hidden",
        marginBottom: 18,
      }}
    >
      <div style={{ padding: "16px 18px", borderBottom: "1px solid #eef2f7" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 950, color: "#0f172a" }}>{title}</h3>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>{subtitle}</p>
      </div>

      {visible.map((service) => (
        <RankedQuoteRow
          key={service.id}
          service={service}
          bookUrl={buildUrl(service)}
          isSaved={isServiceSaved(service)}
          isOpen={openId === service.id}
          onToggle={onToggle}
          onSave={onSaveService}
          origin={origin}
          dest={dest}
        />
      ))}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            width: "100%",
            border: 0,
            borderTop: "1px solid #eef2f7",
            background: "#f8fafc",
            padding: "12px 18px",
            color: "#2563eb",
            fontSize: 13,
            fontWeight: 850,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          View {hiddenCount} more
        </button>
      )}
    </section>
  );
}

export default function SmartResultsSection({
  data,
  origin,
  dest,
  dropDateStr,
  delivDateStr,
  weightLbs,
  pkgSummary,
  selectedPriority,
  openId,
  onToggle,
  buildUrl,
  isServiceSaved,
  onSaveService,
}: SmartResultsSectionProps) {
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [guaranteedOnly, setGuaranteedOnly] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);

  const allServices = useMemo(() => getAllServices(data), [data]);
  const ranked = useMemo(
    () => rankShippingServices(allServices, selectedPriority),
    [allServices, selectedPriority],
  );

  const filtered = useMemo(() => {
    const base = guaranteedOnly ? ranked.filter((service) => service.guaranteed) : ranked;
    return sortRankedServices(base, sortMode);
  }, [ranked, sortMode, guaranteedOnly]);

  const best = ranked[0];
  const major = filtered.filter(isMajorCarrier);
  const specialty = filtered.filter((service) => !isMajorCarrier(service));
  const compareOptions = ranked.map(toCompareOption);

  if (!best) return null;

  return (
    <>
      <RecommendationCard
        best={best}
        buildUrl={buildUrl}
        origin={origin}
        dest={dest}
        onAsk={() => setAdvisorOpen(true)}
      />

      <ResultsToolbar
        sortMode={sortMode}
        setSortMode={setSortMode}
        guaranteedOnly={guaranteedOnly}
        setGuaranteedOnly={setGuaranteedOnly}
      />

      <ProviderGroup
        title="Major carriers"
        subtitle="UPS, FedEx, DHL, and USPS-style carrier options."
        services={major}
        openId={openId}
        onToggle={onToggle}
        buildUrl={buildUrl}
        isServiceSaved={isServiceSaved}
        onSaveService={onSaveService}
        origin={origin}
        dest={dest}
      />

      <ProviderGroup
        title="Specialty shippers"
        subtitle="Luggage and personal-item shipping services."
        services={specialty}
        openId={openId}
        onToggle={onToggle}
        buildUrl={buildUrl}
        isServiceSaved={isServiceSaved}
        onSaveService={onSaveService}
        origin={origin}
        dest={dest}
      />

      {compareOptions.length >= 2 && (
        <div id="compare-options" style={{ scrollMarginTop: 24 }}>
          <CompareSection
            shipment={{
              item_description: pkgSummary,
              origin_zip: origin,
              destination_zip: dest,
              deadline_date: delivDateStr,
              weight_lb: weightLbs,
            }}
            allOptions={compareOptions}
            selectedPriority={selectedPriority}
          />
        </div>
      )}

      <FloatingShipmentAdvisor
        context={{
          origin_zip: origin || undefined,
          destination_zip: dest || undefined,
          weight_lbs: weightLbs || undefined,
          drop_off_date: dropDateStr || undefined,
          expected_delivery_date: delivDateStr || undefined,
        }}
        options={compareOptions}
        selectedPriority={selectedPriority}
        open={advisorOpen}
        onOpenChange={setAdvisorOpen}
        pinnedPrompt={`Why is ${best.carrier} ${best.name} recommended for this shipment?`}
      />
    </>
  );
}
