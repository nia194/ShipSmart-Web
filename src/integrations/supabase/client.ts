import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { apiConfig } from "@/config/api";

if (!apiConfig.supabaseUrl) {
  throw new Error("VITE_SUPABASE_URL is not set. Check .env.local");
}
if (!apiConfig.supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY is not set. Check .env.local");
}

export const supabase = createClient<Database>(apiConfig.supabaseUrl, apiConfig.supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
