/**
 * Central API configuration.
 * All service base URLs are sourced from environment variables.
 * Set these in .env.local for local dev
 * and in Render environment settings for production.
 */

export const apiConfig = {
  /** Spring Boot Java backend — owns core transactional logic */
  javaApiBaseUrl: import.meta.env.VITE_JAVA_API_BASE_URL ?? "http://localhost:8080",

  /** FastAPI Python backend — AI/orchestration workflows */
  pythonApiBaseUrl: import.meta.env.VITE_PYTHON_API_BASE_URL ?? "http://localhost:8000",

  /** Supabase project URL */
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,

  /** Supabase anon key (public) */
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,

  /**
   * Feature flag: use the new Java API for quote generation instead of
   * the legacy Supabase edge function. Set VITE_USE_JAVA_QUOTES=true to enable.
   * Defaults to false (legacy Supabase edge function).
   */
  useJavaQuotes: import.meta.env.VITE_USE_JAVA_QUOTES === "true",

  /**
   * Feature flag: use the new Java API for saved options instead of
   * the legacy Supabase edge functions. Set VITE_USE_JAVA_SAVED_OPTIONS=true to enable.
   * Defaults to false (legacy Supabase edge functions).
   */
  useJavaSavedOptions: import.meta.env.VITE_USE_JAVA_SAVED_OPTIONS === "true",

  /**
   * Feature flag: use the new Java API for booking redirect tracking instead of
   * the legacy Supabase edge function. Set VITE_USE_JAVA_BOOKING_REDIRECT=true to enable.
   * Defaults to false (legacy Supabase edge function).
   */
  useJavaBookingRedirect: import.meta.env.VITE_USE_JAVA_BOOKING_REDIRECT === "true",

  /**
   * Feature flag: show the multi-agent workflow page (UC3/UC4) backed by the
   * Python API's /workflow endpoints. Set VITE_USE_WORKFLOW=true to enable.
   * Defaults to false (the route + nav entry stay hidden).
   */
  useWorkflow: import.meta.env.VITE_USE_WORKFLOW === "true",

  /**
   * Feature flag: show the Conversational Concierge chat, shared with the form
   * via the ShipmentDraft store. Set VITE_USE_CONCIERGE=true to enable.
   * Defaults to false (the panel stays hidden; the form behaves exactly as today).
   */
  useConcierge: import.meta.env.VITE_USE_CONCIERGE === "true",

  /**
   * Shipping-scope policy (mirrors the API's SHIPPING_SCOPE; published on
   * GET /api/v1/info). "worldwide" (default) = cross-border allowed;
   * "domestic" = deliveries within DOMESTIC_COUNTRY only — the form hides the
   * country fields and the result hides duties. Set VITE_SHIPPING_SCOPE=domestic.
   */
  shippingScope: import.meta.env.VITE_SHIPPING_SCOPE ?? "worldwide",

  /** Home country used when shippingScope === "domestic". */
  domesticCountry: import.meta.env.VITE_DOMESTIC_COUNTRY ?? "US",
} as const;

/** True when this deployment only ships within {@link apiConfig.domesticCountry}. */
export const isDomesticOnly = apiConfig.shippingScope === "domestic";

/** Pre-built API path helpers */
export const javaApi = {
  quotes: () => `${apiConfig.javaApiBaseUrl}/api/v1/quotes`,
  savedOptions: () => `${apiConfig.javaApiBaseUrl}/api/v1/saved-options`,
  bookingRedirect: () => `${apiConfig.javaApiBaseUrl}/api/v1/bookings/redirect`,
  /** Read-only shipment fetch (JWT-scoped) — used to hydrate advisor context. */
  shipment: (id: string) => `${apiConfig.javaApiBaseUrl}/api/v1/shipments/${id}`,
} as const;

/** FastAPI Python (AI/advisor) path helpers */
export const pythonApi = {
  advisorShipping: () => `${apiConfig.pythonApiBaseUrl}/api/v1/advisor/shipping`,
  advisorTracking: () => `${apiConfig.pythonApiBaseUrl}/api/v1/advisor/tracking`,
  /** Multi-agent workflow (UC3/UC4). */
  workflowProcess: () => `${apiConfig.pythonApiBaseUrl}/api/v1/workflow/process`,
  workflow: (id: string) => `${apiConfig.pythonApiBaseUrl}/api/v1/workflow/${id}`,
  workflowReview: (id: string) => `${apiConfig.pythonApiBaseUrl}/api/v1/workflow/${id}/review`,
  /** Conversational Concierge — stateful slot-filling chat. */
  conciergeChat: () => `${apiConfig.pythonApiBaseUrl}/api/v1/concierge/chat`,
  /** Persisted conversation for recall after a page reload (server memory). */
  conciergeHistory: (sessionId: string) =>
    `${apiConfig.pythonApiBaseUrl}/api/v1/concierge/${sessionId}`,
} as const;
