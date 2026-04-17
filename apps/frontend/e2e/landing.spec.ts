import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("should render hero section with CTA", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toContainText(
      /TheIAdvisor|vendas|sales/i,
      { timeout: 10_000 },
    );
    await expect(
      page.getByRole("link", { name: /começar|start/i }).first(),
    ).toBeVisible();
  });

  test("should render features section", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const featureCards = page.locator('[class*="grid"] > div').first();
    await expect(featureCards).toBeVisible({ timeout: 10_000 });
  });

  test("should navigate to sign-up from CTA", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 10_000 });
    const ctaButton = page
      .getByRole("link", { name: /começar|start|grátis|free/i })
      .first();
    await ctaButton.click();
    await expect(page).toHaveURL(/sign-up|register/, { timeout: 10_000 });
  });

  test("should have proper meta tags", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("title", { state: "attached", timeout: 10_000 });
    const title = await page.title();
    expect(title).toContain("TheIAdvisor");

    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(description).toBeTruthy();
    expect(description!.length).toBeGreaterThan(50);
  });

  test("should have manifest link for PWA", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveAttribute("href", "/manifest.json");
  });
});
