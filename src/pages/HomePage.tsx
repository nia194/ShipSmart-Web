// src/pages/HomePage.tsx

// TODO: [MIGRATION] This page uses useShippingQuotes which can call the legacy
// "get-shipping-quotes" Supabase edge function unless VITE_USE_JAVA_QUOTES=true.
// Keep quote fetching in Java/quote layer later, and keep AI/concierge separate.

import { useMemo, useRef, useState } from "react";

import HeroSection from "@/components/home/HeroSection";
import ShipSmartAssistant from "@/components/home/ShipSmartAssistant";

import ShipmentProgressForm, {
  type ShipmentDraftSnapshot,
  type ShipmentSearchPayload,
} from "@/components/shipment-form/ShipmentProgressForm";

import QuoteResultsSection from "@/components/shipping-results/QuoteResultsSection";

import { buildBookUrl, type ShippingService } from "@/lib/shipping-data";
import type {
  CompareOption,
  Priority,
} from "@/components/shipping/compare.types";

import { useShippingQuotes } from "@/hooks/useShippingQuotes";
import { useAuth } from "@/contexts/AuthContext";
import { SaveSignInModal } from "@/components/auth/SaveSignInModal";

import { ShipmentDraftProvider } from "@/state/ShipmentDraftContext";

import heroSectionImage from "@/logos/hero section.png";

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

function buildSavedContext(
  svc: ShippingService,
  search: ShipmentSearchPayload,
) {
  return {
    origin: search.origin,
    dest: search.dest,
    dropDate: search.dropDateStr,
    delivDate: search.delivDateStr,
    pkgSummary: search.packageSummary,
    bookUrl: buildBookUrl(
      svc,
      search.origin,
      search.dest,
      search.dropDateStr,
      search.delivDateStr,
      search.packages,
    ),
  };
}

function HomePageInner({ savedIds, onSaveService }: HomePageProps) {
  const { user } = useAuth();
  const { loading, data, fetchQuotes } = useShippingQuotes();

  const resultsRef = useRef<HTMLDivElement>(null);

  const [latestSearch, setLatestSearch] =
    useState<ShipmentSearchPayload | null>(null);

  const [latestDraft, setLatestDraft] =
    useState<ShipmentDraftSnapshot | null>(null);

  const [resultsLoaded, setResultsLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [pendingSaveService, setPendingSaveService] =
    useState<ShippingService | null>(null);

  const shipmentPriority: Priority = "ontime";

  const visibleQuoteOptions = useMemo<CompareOption[]>(() => {
    if (!data) return [];

    return [
      ...(data.prime?.top ?? []),
      ...(data.prime?.more ?? []),
      ...(data.private?.top ?? []),
      ...(data.private?.more ?? []),
    ].map(serviceToCompareOption);
  }, [data]);

  const handleToggleResult = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  const handleSearch = (payload: ShipmentSearchPayload) => {
    setLatestSearch(payload);
    setResultsLoaded(true);
    setOpenId(null);

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);

    fetchQuotes(
      payload.origin,
      payload.dest,
      payload.dropDateStr,
      payload.delivDateStr,
      payload.packages,
    );
  };

  const handleSaveWithAuth = (svc: ShippingService) => {
    if (!latestSearch) return;

    if (!user) {
      setPendingSaveService(svc);
      setSignInModalOpen(true);
      return;
    }

    onSaveService(svc, buildSavedContext(svc, latestSearch));
  };

  const handleSignInComplete = () => {
    if (!pendingSaveService || !latestSearch) return;

    onSaveService(
      pendingSaveService,
      buildSavedContext(pendingSaveService, latestSearch),
    );

    setPendingSaveService(null);
  };

  return (
    <div className="ss-page">
      <main className="ss-home-shell">
        <section className="ss-hero-layout">
          <div className="ss-hero-left">
            <HeroSection />

            <ShipmentProgressForm
              isSearching={loading}
              hasResults={resultsLoaded}
              onSearch={handleSearch}
              onDraftChange={setLatestDraft}
            />
            <QuoteResultsSection
          resultsLoaded={resultsLoaded}
          resultsRef={resultsRef}
          loading={loading}
          data={data}
          search={latestSearch}
          savedIds={savedIds}
          openId={openId}
          selectedPriority={shipmentPriority}
          onToggle={handleToggleResult}
          onSaveService={handleSaveWithAuth}
        />
          </div>

          <div className="ss-hero-right">
            <img
              src={heroSectionImage}
              alt="ShipSmart packages"
              className="ss-hero-image"
            />
          </div>
        </section>

      </main>

      <ShipSmartAssistant
        quoteOptions={visibleQuoteOptions}
        selectedPriority={shipmentPriority}
        formSnapshot={latestDraft}
      />

      <SaveSignInModal
        open={signInModalOpen}
        onOpenChange={setSignInModalOpen}
        onSignInComplete={handleSignInComplete}
      />
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
