import { expect, test } from "@playwright/test";

/**
 * Web-flow smoke: the real SPA rendered in a browser. Verifies the app boots
 * cleanly and the core shipping form is interactive. Backend-dependent flows
 * (quotes/compare) are covered by ShipSmart-Test e2e; this guards the frontend
 * shell itself, which unit/component tests (jsdom) can't fully catch.
 */
test.describe("ShipSmart web — home smoke", () => {
  test("boots and renders the shipping form without runtime errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));

    await page.goto("/");
    await expect(page).toHaveTitle(/ShipSmart/i);

    // Core home-page landmarks (the quote wizard's route inputs).
    await expect(page.getByPlaceholder("From city or ZIP")).toBeVisible();
    await expect(page.getByPlaceholder("To city or ZIP")).toBeVisible();

    expect(
      pageErrors,
      `uncaught page errors on load:\n${pageErrors.join("\n")}`,
    ).toHaveLength(0);
  });

  test("the route inputs accept a city pair", async ({ page }) => {
    await page.goto("/");
    const from = page.getByPlaceholder("From city or ZIP");
    const to = page.getByPlaceholder("To city or ZIP");

    await from.fill("Chicago");
    await to.fill("Denver");

    await expect(from).toHaveValue("Chicago");
    await expect(to).toHaveValue("Denver");
  });
});
