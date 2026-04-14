// ============================================================
// AI / RAG / MCP — Placeholder types for future integration
// ============================================================
// These types define the data contracts for:
//   - Provider knowledge ingestion & retrieval (RAG)
//   - LLM-powered quote enrichment & recommendation
//   - MCP-based notification dispatch
// They will be used as reference specs when building the actual
// RAG pipeline, LLM orchestration, and MCP connectors.
// ============================================================

// -────────────────────────────────────────────────────────────
// 1. PROVIDER KNOWLEDGE (RAG SOURCE DATA)
// -────────────────────────────────────────────────────────────

/**
 * Provider knowledge entry stored in DB (future: provider_knowledge table).
 * Holds carrier-specific data ingested by the RAG pipeline.
 */
export interface ProviderKnowledgeEntry {
  id: string;
  carrier: string;
  source_url: string;
  content_type:
    | "provider_fit"
    | "restrictions"
    | "service_model"
    | "policy"
    | "pricing"
    | "service_update";
  title: string;
  body: string;
  embedding_vector?: number[];
  metadata: Record<string, string>;
  last_synced_at: string;
  created_at: string;
}

// -────────────────────────────────────────────────────────────
// 2. RAG RETRIEVAL RESULT
// -────────────────────────────────────────────────────────────

export interface RAGRetrievalResult {
  entry: ProviderKnowledgeEntry;
  similarity_score: number;
  carrier: string;
  content_type: ProviderKnowledgeEntry["content_type"];
}

// -────────────────────────────────────────────────────────────
// 3. QUOTE ENRICHMENT (LLM OUTPUT PER SERVICE)
// -────────────────────────────────────────────────────────────

export interface QuoteEnrichment {
  service_id: string;
  recommendation_reason: string;
  comparison_summary: string;
  provider_strength_note: string;
  restriction_note: string | null;
  confidence_level: number;
  best_for_label: string;
  caution_note: string | null;
}

// -────────────────────────────────────────────────────────────
// 4. TRADEOFF ANALYSIS (LLM OUTPUT FOR OVERALL COMPARISON)
// -────────────────────────────────────────────────────────────

export interface TradeoffAnalysis {
  tradeoffs: {
    dimension: string;
    summary: string;
    favors_service_id: string | null;
  }[];
  overall_summary: string;
  recommended_service_id: string | null;
  overall_confidence: number;
}

// -────────────────────────────────────────────────────────────
// 5. AI ADVISOR REQUEST / RESPONSE (EDGE FUNCTION CONTRACT)
// -────────────────────────────────────────────────────────────

export interface AIAdvisorRequest {
  query: string;
  shipment_context?: {
    origin: string;
    destination: string;
    weight: number;
    packages: number;
    package_types: string[];
    handling_types: string[];
    drop_off_date: string;
    delivery_date: string;
  };
  quote_ids?: string[];
  user_priority?: "price" | "speed" | "convenience" | "safety";
}

export interface AIAdvisorResponse {
  recommendation: string;
  confidence: number;
  reasoning: string;
  suggested_service_id: string | null;
  sources: { title: string; url: string; relevance: number }[];
  follow_up_questions: string[];
  enrichments: QuoteEnrichment[];
  tradeoff_analysis: TradeoffAnalysis | null;
}

// -────────────────────────────────────────────────────────────
// 6. RAG INGESTION PIPELINE TYPES (FUTURE)
// -────────────────────────────────────────────────────────────

export interface RAGIngestionSource {
  carrier: string;
  source_url: string;
  content_type: ProviderKnowledgeEntry["content_type"];
  extraction_hint?: string;
  sync_schedule?: string;
}

export interface RAGIngestionResult {
  source_url: string;
  chunks_created: number;
  chunks_updated: number;
  chunks_deleted: number;
  errors: string[];
  completed_at: string;
}

// -────────────────────────────────────────────────────────────
// 7. NOTIFICATION TYPES (MCP PLACEHOLDER)
// -────────────────────────────────────────────────────────────

export type NotificationEventType =
  | "welcome_confirmation"
  | "price_drop_alert"
  | "promo_available"
  | "service_expiring";

export interface NotificationSubscription {
  id: string;
  user_id: string;
  saved_option_id: string;
  channel: "email" | "sms";
  phone_number?: string;
  enabled: boolean;
  created_at: string;
}

export interface NotificationAttempt {
  id: string;
  subscription_id: string;
  event_type: NotificationEventType;
  channel: "email" | "sms";
  status: "pending" | "sent" | "failed" | "no_credentials";
  error_message?: string;
  payload: Record<string, unknown>;
  created_at: string;
}

// -────────────────────────────────────────────────────────────
// 8. TRACKING EXCEPTION ADVISOR (USE CASE #2)
// -────────────────────────────────────────────────────────────

export interface TrackingEvent {
  timestamp: string;
  event_code: string;
  description: string;
  location: string;
  carrier: string;
  is_exception: boolean;
}

export interface TrackingAdvisorRequest {
  tracking_id: string;
  carrier: string;
  events: TrackingEvent[];
  exception_event?: TrackingEvent;
}

export interface TrackingAdvisorResponse {
  explanation: string;
  severity: "info" | "warning" | "critical";
  next_steps: string[];
  action_required: boolean;
  estimated_resolution: string | null;
  escalation_guidance: string | null;
  confidence: number;
  sources: { title: string; carrier: string; relevance: number }[];
}

// -────────────────────────────────────────────────────────────
// 9. USER PRIORITY INTERPRETER (USE CASE #3)
// -────────────────────────────────────────────────────────────

export interface PriorityInterpreterRequest {
  structured_priority: "price" | "speed" | "value" | "special_items";
  free_text_priority?: string;
  shipment_context?: {
    origin: string;
    destination: string;
    package_types: string[];
    drop_off_date: string;
    delivery_date: string;
  };
}

export interface PriorityWeights {
  price_weight: number;
  speed_weight: number;
  reliability_weight: number;
  package_fit_weight: number;
  convenience_weight: number;
}

export interface PriorityInterpreterResponse {
  weights: PriorityWeights;
  interpretation_summary: string;
  used_free_text: boolean;
  confidence: number;
}

// -────────────────────────────────────────────────────────────
// 10. COMPARISON EXPLANATION (USE CASE #1)
// -────────────────────────────────────────────────────────────

export interface ComparisonExplanation {
  best_for_price: { service_id: string; reason: string };
  best_for_speed: { service_id: string; reason: string };
  best_for_value: { service_id: string; reason: string };
  best_for_special_items: { service_id: string; reason: string } | null;
  tradeoff_summary: string;
  general_cautions: string[];
}

// -────────────────────────────────────────────────────────────
// 11. NOTIFICATION CONTENT GENERATION (USE CASE #5)
// -────────────────────────────────────────────────────────────

export interface NotificationContentRequest {
  event_type: NotificationEventType;
  channel: "email" | "sms";
  context: {
    user_name?: string;
    carrier?: string;
    service_name?: string;
    route?: string;
    old_price?: number;
    new_price?: number;
    promo_details?: string;
    expiry_date?: string;
    saved_option_summary?: string;
  };
}

export interface NotificationContentResponse {
  subject: string | null;
  body: string;
  sms_text: string | null;
  cta_text: string | null;
  cta_url: string | null;
}
