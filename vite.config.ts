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
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
  }));
