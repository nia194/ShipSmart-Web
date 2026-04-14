// Quote fetching hook with backend toggle.
// Set VITE_USE_JAVA_QUOTES=true to use the new Java API.
// Defaults to the legacy Supabase edge function.

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PackageItem, QuoteResults } from "@/lib/shipping-data";
import { useToast } from "@/hooks/use-toast";
import { apiConfig, javaApi } from "@/config/api";

export function useShippingQuotes() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<QuoteResults | null>(null);
  const { toast } = useToast();

  const fetchQuotes = async (
    origin: string,
    destination: string,
    dropDate: string,
    delivDate: string,
    packages: PackageItem[]
  ) => {
    setLoading(true);
    // Don't clear data on re-fetch — keep old results visible during refresh
    // so CompareSection stays mounted. First load starts with data=null anyway.

    try {
      let result: QuoteResults;

      if (apiConfig.useJavaQuotes) {
        // New Java API backend
        const res = await fetch(javaApi.quotes(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin,
            destination,
            dropOffDate: dropDate,
            expectedDeliveryDate: delivDate,
            packages,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || `Quote request failed (${res.status})`);
        }

        result = await res.json();
      } else {
        // Legacy Supabase edge function
        const { data: legacyResult, error } = await supabase.functions.invoke(
          "get-shipping-quotes",
          {
            body: {
              origin,
              destination,
              dropOffDate: dropDate,
              expectedDeliveryDate: delivDate,
              packages,
            },
          }
        );

        if (error) throw error;
        result = legacyResult as QuoteResults;
      }

      setData(result);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch quotes";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return { loading, data, fetchQuotes };
}
