/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// NOTE: lovable-tagger has been intentionally removed.
// This config is migration-ready from the Lovable project.

export default defineConfig(({ mode }) => ({
    server: {
      host: "::",
      port: 5173,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      // dedupe prevents duplicate React instances when workspace packages
      // bring their own copies. @tanstack/query-core removed — it's internal
      // to @tanstack/react-query and not resolvable as a top-level dep in pnpm.
      dedupe: [
        "react",
        "react-dom",
      ],
    },
    build: {
      outDir: "dist",
      sourcemap: mode !== "production",
      rollupOptions: {
        output: {
          // Split large, rarely-changing vendor libs into their own cacheable
          // chunks so the main bundle stays well under the size-warning limit.
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            supabase: ["@supabase/supabase-js"],
            query: ["@tanstack/react-query"],
          },
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  }));
