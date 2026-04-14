/**
 * Advisor API Service Layer
 * Provides typed wrappers for FastAPI advisor endpoints.
 */

import { pythonApi } from "@/config/api";

// ─────────────────────────────────────────────────────────────────────────
// Shipping Advisor Types
// ─────────────────────────────────────────────────────────────────────────

export interface ShippingAdvisorRequest {
  query: string;
  context?: {
    origin_zip?: string;
    destination_zip?: string;
    weight_lbs?: number;
    length_in?: number;
    width_in?: number;
    height_in?: number;
    [key: string]: string | number | undefined;
  };
}

export interface ShippingAdvisorResponse {
  answer: string;
  reasoning_summary: string;
  tools_used: string[];
  sources: Array<{
    source: string;
    chunk_index: number;
    score: number;
  }>;
  context_used: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Tracking Advisor Types
// ─────────────────────────────────────────────────────────────────────────

export interface TrackingAdvisorRequest {
  issue: string;
  context?: {
    street?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    tracking_number?: string;
    carrier?: string;
    [key: string]: string | undefined;
  };
}

export interface TrackingAdvisorResponse {
  guidance: string;
  issue_summary: string;
  tools_used: string[];
  sources: Array<{
    source: string;
    chunk_index: number;
    score: number;
  }>;
  next_steps: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// Recommendation Types
// ─────────────────────────────────────────────────────────────────────────

export interface ServiceOption {
  service_name: string;
  price_usd: number;
  estimated_days: number;
  recommendation_type: "cheapest" | "fastest" | "best_value" | "balanced";
  explanation: string;
  score: number;
}

export interface RecommendationRequest {
  services: Array<{
    service: string;
    price_usd: number;
    estimated_days: number;
  }>;
  context?: {
    fragile?: boolean;
    urgent?: boolean;
    budget_preference?: string;
    [key: string]: boolean | string | undefined;
  };
}

export interface RecommendationResponse {
  primary_recommendation: ServiceOption;
  alternatives: ServiceOption[];
  summary: string;
  metadata: {
    num_options: number;
    primary_type: string;
    [key: string]: unknown;
  };
}

// ─────────────────────────────────────────────────────────────────────────
// API Service Functions
// ─────────────────────────────────────────────────────────────────────────

class AdvisorService {
  /**
   * Get shipping advice by combining RAG context, tools, and LLM reasoning.
   */
  async getShippingAdvice(
    request: ShippingAdvisorRequest,
  ): Promise<ShippingAdvisorResponse> {
    const response = await fetch(pythonApi.advisors.shipping(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Shipping advisor failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get tracking/delivery guidance.
   */
  async getTrackingGuidance(
    request: TrackingAdvisorRequest,
  ): Promise<TrackingAdvisorResponse> {
    const response = await fetch(pythonApi.advisors.tracking(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Tracking advisor failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get service recommendations with scoring and explanations.
   */
  async getRecommendations(
    request: RecommendationRequest,
  ): Promise<RecommendationResponse> {
    const response = await fetch(pythonApi.advisors.recommendation(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Recommendation failed: ${response.statusText}`);
    }

    return response.json();
  }
}

export const advisorService = new AdvisorService();
