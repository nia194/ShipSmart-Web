// src/components/shipping-results/QuoteResultsSection.tsx

import type { Ref } from "react";

import { Section } from "@/components/shipping/QuoteRow";
import { CompareSection } from "@/components/shipping/CompareSection";

import {
  buildBookUrl,
  type QuoteResults,
  type ShippingService,
} from "@/lib/shipping-data";

import {
  type CompareOption,
  type Priority,
} from "@/components/shipping/compare.types";

import { buildSnapshotKey } from "@/hooks/useSavedOptions";

import type { ShipmentSearchPayload } from "@/components/shipment-form/ShipmentProgressForm";

interface QuoteResultsSectionProps {
  resultsLoaded: boolean;
  resultsRef?: Ref<HTMLDivElement>;
  loading: boolean;
  data: QuoteResults | null;
  search: ShipmentSearchPayload | null;
  savedIds: Set<string>;
  openId: string | null;
  selectedPriority: Priority;
  onToggle: (id: string) => void;
  onSaveService: (svc: ShippingService) => void;
}

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

function LoadingSkeleton() {
  return (
    <div className="ss-loading">
      {[1, 2].map((section) => (
        <div key={section} className="ss-loading-section">
          <div className="shim ss-loading-title" />

          <div className="ss-loading-card">
            {[1, 2, 3].map((row) => (
              <div key={row} className="ss-loading-row">
                <div className="shim ss-loading-logo" />

                <div className="ss-loading-copy">
                  <div className="shim ss-loading-line-lg" />
                  <div className="shim ss-loading-line-sm" />
                </div>

                <div className="shim ss-loading-price" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function getSavedServiceIds(
  services: ShippingService[],
  savedIds: Set<string>,
  search: ShipmentSearchPayload | null,
) {
  if (!search) return new Set<string>();

  return new Set(
    services
      .filter((svc) => {
        const key = buildSnapshotKey(
          svc.id,
          search.origin,
          search.dest,
          search.dropDateStr,
          search.delivDateStr,
        );

        return savedIds.has(key);
      })
      .map((svc) => svc.id),
  );
}

export default function QuoteResultsSection({
  resultsLoaded,
  resultsRef,
  loading,
  data,
  search,
  savedIds,
  openId,
  selectedPriority,
  onToggle,
  onSaveService,
}: QuoteResultsSectionProps) {
  if (!resultsLoaded) return null;

  const allServices: ShippingService[] = data
    ? [
        ...(data.prime?.top ?? []),
        ...(data.prime?.more ?? []),
        ...(data.private?.top ?? []),
        ...(data.private?.more ?? []),
      ]
    : [];

  const visibleQuoteOptions = allServices.map(serviceToCompareOption);

  const buildUrl = (svc: ShippingService) => {
    if (!search) return "#";

    return buildBookUrl(
      svc,
      search.origin,
      search.dest,
      search.dropDateStr,
      search.delivDateStr,
      search.packages,
    );
  };

  return (
    <section ref={resultsRef} className="ss-results-wrap">
      {loading && !data && <LoadingSkeleton />}

      {data && search && (
        <div
          className="ss-results-content"
          style={{
            opacity: loading ? 0.45 : 1,
            pointerEvents: loading ? "none" : "auto",
          }}
        >
          {data.prime && (
            <Section
              icon="🏢"
              title="Prime Providers"
              subtitle="Major carriers with guaranteed service levels"
              badge={{
                bg: "#eff6ff",
                c: "#1d4ed8",
                label: "VERIFIED",
              }}
              topRows={data.prime.top ?? []}
              moreRows={data.prime.more ?? []}
              openId={openId}
              onToggle={onToggle}
              animBase={0.1}
              buildUrl={buildUrl}
              savedIds={getSavedServiceIds(
                [...(data.prime.top ?? []), ...(data.prime.more ?? [])],
                savedIds,
                search,
              )}
              onSaveService={onSaveService}
              origin={search.origin}
              dest={search.dest}
            />
          )}

          {data.private && (
            <Section
              icon="🚀"
              title="Private Providers"
              subtitle="Specialized shippers for luggage & personal items"
              badge={{
                bg: "#f0fdf4",
                c: "#15803d",
                label: "SPECIALIST",
              }}
              topRows={data.private.top ?? []}
              moreRows={data.private.more ?? []}
              openId={openId}
              onToggle={onToggle}
              animBase={0.3}
              buildUrl={buildUrl}
              savedIds={getSavedServiceIds(
                [...(data.private.top ?? []), ...(data.private.more ?? [])],
                savedIds,
                search,
              )}
              onSaveService={onSaveService}
              origin={search.origin}
              dest={search.dest}
            />
          )}

          {visibleQuoteOptions.length >= 2 && (
            <CompareSection
              shipment={{
                item_description: search.packageSummary,
                origin_zip: search.origin,
                destination_zip: search.dest,
                deadline_date: search.delivDateStr,
                weight_lb: search.totalWeight,
              }}
              allOptions={visibleQuoteOptions}
              selectedPriority={selectedPriority}
            />
          )}
        </div>
      )}
    </section>
  );
}