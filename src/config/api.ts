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

  appEnv: import.meta.env.VITE_APP_ENV ?? "development",

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
} as const;

/** Pre-built API path helpers */
export const javaApi = {
  health: () => `${apiConfig.javaApiBaseUrl}/api/v1/health`,
  shipments: () => `${apiConfig.javaApiBaseUrl}/api/v1/shipments`,
  quotes: () => `${apiConfig.javaApiBaseUrl}/api/v1/quotes`,
  savedOptions: () => `${apiConfig.javaApiBaseUrl}/api/v1/saved-options`,
  bookingRedirect: () => `${apiConfig.javaApiBaseUrl}/api/v1/bookings/redirect`,
} as const;

export const pythonApi = {
  health: () => `${apiConfig.pythonApiBaseUrl}/health`,
  advisors: {
    shipping: () => `${apiConfig.pythonApiBaseUrl}/api/v1/advisor/shipping`,
    tracking: () => `${apiConfig.pythonApiBaseUrl}/api/v1/advisor/tracking`,
    recommendation: () => `${apiConfig.pythonApiBaseUrl}/api/v1/advisor/recommendation`,
  },
  rag: {
    query: () => `${apiConfig.pythonApiBaseUrl}/api/v1/rag/query`,
    ingest: () => `${apiConfig.pythonApiBaseUrl}/api/v1/rag/ingest`,
  },
  orchestration: {
    run: () => `${apiConfig.pythonApiBaseUrl}/api/v1/orchestration/run`,
    tools: () => `${apiConfig.pythonApiBaseUrl}/api/v1/orchestration/tools`,
  },
} as const;
