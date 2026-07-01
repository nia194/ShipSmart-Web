import { defineConfig, devices } from "@playwright/test";

/**
 * Browser (web-flow) smoke for ShipSmart-Web. Runs against a live dev server and,
 * when the backends are up, exercises the real UI. Kept separate from Vitest
 * (unit/component) — run with `pnpm test:e2e`.
 *
 * Reuses an already-running dev server on :5173 if present, otherwise starts one.
 */
export default defineConfig({
  testDir: "./e2e-web",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: process.env.WEB_BASE_URL || "http://localhost:5173",
    headless: true,
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
