/**
 * Hook that fetches AI recommendations after quotes load.
 * Calls the Python recommendation endpoint, mapping ShippingService[] to the API format.
 * Fails silently — recommendation is advisory, not blocking.
 */

import { useState, useEffect } from "react";
import { advisorService, RecommendationResponse } from "@/lib/advisor-api";
import type { ShippingService } from "@/lib/shipping-data";

export function useRecommendation(services: ShippingService[] | null) {
  const [recommendation, setRecommendation] =
    useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!services || services.length === 0) {
      setRecommendation(null);
      return;
    }

    let cancelled = false;

    const fetchRecommendation = async () => {
      setLoading(true);
      try {
        const mapped = services.map((s) => ({
          service: `${s.carrier} ${s.name}`,
          price_usd: s.price,
          estimated_days: s.transitDays,
        }));

        const result = await advisorService.getRecommendations({
          services: mapped,
        });

        if (!cancelled) {
          setRecommendation(result);
        }
      } catch {
        // Fail silently — recommendation is non-critical
        if (!cancelled) {
          setRecommendation(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchRecommendation();
    return () => {
      cancelled = true;
    };
  }, [services]);

  return { recommendation, loading };
}
