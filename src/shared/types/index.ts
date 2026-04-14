/**
 * Shared TypeScript types for ShipSmart-Web.
 *
 * These types represent the canonical shape of domain objects
 * and serve as the contract between frontend and backend services.
 *
 * TODO: Populate these from the Lovable Supabase types (integrations/supabase/types.ts).
 * As the Java API stabilises, align these with the Java DTOs.
 */

// ── Shipment Request ──────────────────────────────────────────────────────────

export interface Package {
  weight: number;     // lbs
  length: number;     // inches
  width: number;      // inches
  height: number;     // inches
  quantity: number;
}

export interface ShipmentRequest {
  id: string;
  userId: string | null;
  origin: string;
  destination: string;
  dropOffDate: string;      // ISO date
  expectedDeliveryDate: string; // ISO date
  packages: Package[];
  totalItems: number;
  totalWeight: number;
  createdAt: string;
}

// ── Quote ─────────────────────────────────────────────────────────────────────

export type QuoteTier = "economy" | "standard" | "express" | "overnight";

export interface Quote {
  id: string;
  shipmentRequestId: string;
  carrier: string;
  serviceId: string;
  serviceName: string;
  providerType: string;
  price: number;
  originalPrice: number | null;
  transitDays: number;
  tier: QuoteTier;
  estimatedDeliveryDate: string | null;
  deliverByTime: string | null;
  guaranteed: boolean | null;
  isTopPick: boolean | null;
  rankScore: number | null;
  aiRecommendation: string | null;
  features: string[] | null;
  promo: Record<string, unknown> | null;
  breakdown: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

// ── Saved Option ──────────────────────────────────────────────────────────────

export interface SavedOption {
  id: string;
  userId: string;
  carrier: string;
  quoteServiceId: string;
  serviceName: string;
  origin: string;
  destination: string;
  price: number;
  originalPrice: number | null;
  transitDays: number;
  tier: QuoteTier;
  estimatedDelivery: string | null;
  expectedDeliveryDate: string | null;
  deliverByTime: string | null;
  dropOffDate: string | null;
  guaranteed: boolean | null;
  bookUrl: string | null;
  packageSummary: string | null;
  aiRecommendation: string | null;
  features: string[] | null;
  promo: Record<string, unknown> | null;
  breakdown: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

// ── User / Auth ───────────────────────────────────────────────────────────────

export type AppRole = "admin" | "moderator" | "user";

export interface UserProfile {
  id: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── API Responses ─────────────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
