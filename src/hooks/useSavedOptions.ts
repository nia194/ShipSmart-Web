// Saved options hook with backend toggle.
// Set VITE_USE_JAVA_SAVED_OPTIONS=true to use the new Java API.
// Defaults to the legacy Supabase edge functions.

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ShippingService } from "@/lib/shipping-data";
import { useToast } from "@/hooks/use-toast";
import { apiConfig, javaApi } from "@/config/api";

export interface SavedOption {
  id: string;
  svcId: string;
  svc: ShippingService;
  origin: string;
  dest: string;
  dropDate: string;
  delivDate: string;
  pkgSummary: string;
  bookUrl: string;
  savedAt: string;
}

/** Build a composite key that uniquely identifies a saved quote snapshot */
export function buildSnapshotKey(svcId: string, origin: string, dest: string, dropDate: string, delivDate: string) {
  return `${svcId}|${origin}|${dest}|${dropDate}|${delivDate}`;
}

/** Get the current Supabase access token for Java API calls. */
async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Helper for authenticated Java API fetch calls. */
async function javaFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

export function useSavedOptions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [savedOptions, setSavedOptions] = useState<SavedOption[]>([]);
  const [loading, setLoading] = useState(false);

  const savedIds = useMemo(
    () => new Set(savedOptions.map(s => buildSnapshotKey(s.svcId, s.origin, s.dest, s.dropDate, s.delivDate))),
    [savedOptions]
  );

  const fetchSaved = useCallback(async () => {
    if (!user) { setSavedOptions([]); return; }
    setLoading(true);
    try {
      if (apiConfig.useJavaSavedOptions) {
        const res = await javaFetch(javaApi.savedOptions());
        if (!res.ok) throw new Error(`Failed to fetch saved options (${res.status})`);
        const data = await res.json();
        setSavedOptions((data as SavedOption[]) || []);
      } else {
        const { data, error } = await supabase.functions.invoke("get-saved-options");
        if (error) throw error;
        setSavedOptions((data as SavedOption[]) || []);
      }
    } catch {
      // silent fail on load — matches legacy behavior
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchSaved(); }, [fetchSaved]);

  const toggleSave = async (
    svc: ShippingService,
    context: { origin: string; dest: string; dropDate: string; delivDate: string; pkgSummary: string; bookUrl: string }
  ) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Create an account to save shipping options.", variant: "destructive" });
      return;
    }

    const snapshotKey = buildSnapshotKey(svc.id, context.origin, context.dest, context.dropDate, context.delivDate);

    if (savedIds.has(snapshotKey)) {
      // unsave — find the matching saved option by snapshot key
      const option = savedOptions.find(s =>
        buildSnapshotKey(s.svcId, s.origin, s.dest, s.dropDate, s.delivDate) === snapshotKey
      );
      if (!option) return;
      try {
        if (apiConfig.useJavaSavedOptions) {
          const res = await javaFetch(`${javaApi.savedOptions()}/${option.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error("Failed to remove");
        } else {
          await supabase.functions.invoke("remove-saved-option", { body: { id: option.id } });
        }
        setSavedOptions(prev => prev.filter(s => s.id !== option.id));
        toast({ title: "Removed", description: `${svc.name} removed from saved.` });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Failed to remove.";
        toast({ title: "Error", description: errMsg, variant: "destructive" });
      }
    } else {
      // save
      try {
        const body = {
          quoteServiceId: svc.id,
          carrier: svc.carrier,
          serviceName: svc.name,
          tier: svc.tier,
          price: svc.price,
          originalPrice: svc.originalPrice,
          transitDays: svc.transitDays,
          estimatedDelivery: svc.date,
          deliverByTime: svc.deliverBy,
          guaranteed: svc.guaranteed,
          promo: svc.promo,
          aiRecommendation: svc.ai,
          breakdown: svc.breakdown,
          details: svc.details,
          features: svc.features,
          origin: context.origin,
          destination: context.dest,
          dropOffDate: context.dropDate,
          expectedDeliveryDate: context.delivDate,
          packageSummary: context.pkgSummary,
          bookUrl: context.bookUrl,
        };

        let saved: SavedOption;

        if (apiConfig.useJavaSavedOptions) {
          const res = await javaFetch(javaApi.savedOptions(), {
            method: "POST",
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || `HTTP ${res.status}: Failed to save`);
          }
          saved = await res.json();
        } else {
          const { data, error } = await supabase.functions.invoke("save-option", { body });
          if (error) throw error;
          saved = data as SavedOption;
        }

        setSavedOptions(prev => [saved, ...prev]);
        toast({ title: "Saved!", description: `${svc.name} saved.` });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Failed to save.";
        console.error("Save failed:", err);
        toast({ title: "Error", description: errMsg, variant: "destructive" });
      }
    }
  };

  const removeSaved = async (id: string) => {
    try {
      if (apiConfig.useJavaSavedOptions) {
        const res = await javaFetch(`${javaApi.savedOptions()}/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to remove");
      } else {
        await supabase.functions.invoke("remove-saved-option", { body: { id } });
      }
      setSavedOptions(prev => prev.filter(s => s.id !== id));
      toast({ title: "Removed" });
    } catch {
      toast({ title: "Error", description: "Failed to remove.", variant: "destructive" });
    }
  };

  return { savedOptions, savedIds, toggleSave, removeSaved, loading };
}
