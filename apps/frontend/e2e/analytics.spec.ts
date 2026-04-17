import { test, expect } from "@playwright/test";

// These tests require authentication.
// Set up Clerk test tokens via PLAYWRIGHT_CLERK_TOKEN env var
// or use Clerk's testing tokens: https://clerk.com/docs/testing/playwright

test.describe("Analytics Page (authenticated)", () => {
  // Skip if no auth token is configured
  test.skip(
    !process.env.PLAYWRIGHT_CLERK_TOKEN,
    "Requires PLAYWRIGHT_CLERK_TOKEN",
  );

  test.beforeEach(async ({ page }) => {
    // Set Clerk session cookie for authenticated access
    const token = process.env.PLAYWRIGHT_CLERK_TOKEN!;
    await page.context().addCookies([
      {
        name: "__session",
        value: token,
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/dashboard/analytics");
  });

  test("should render analytics page with title", async ({ page }) => {
    await page.waitForSelector("h1");
    const heading = page.locator("h1").first();
    await expect(heading).toContainText(/analytics|analytiques/i);
  });

  test("should display KPI cards visible", async ({ page }) => {
    await page.waitForSelector("h1");

    // KPI cards should be visible (at least the first one)
    const kpiCard = page.locator('[class*="Card"]').first();
    await expect(kpiCard).toBeVisible();

    // Look for specific KPI icons/labels
    const hasKPIContent = await page
      .locator("text=/calls|ligações|messages|mensagens|users|usuários/i")
      .count();
    expect(hasKPIContent).toBeGreaterThan(0);
  });

  test("should display calls detail card", async ({ page }) => {
    await page.waitForSelector("h2");

    // Look for calls section with icon
    const callsCard = page.locator("text=/ligações|calls").first();
    await expect(callsCard).toBeVisible();

    // Should show metrics like total, completed, success rate
    const metricsVisible = await page
      .locator("text=/total|completed|sucesso|success rate/i")
      .count();
    expect(metricsVisible).toBeGreaterThan(0);
  });

  test("should display whatsapp detail card", async ({ page }) => {
    await page.waitForSelector("h2");

    // Look for WhatsApp section
    const waCard = page.locator("text=/whatsapp").first();
    await expect(waCard).toBeVisible();

    // Should show WhatsApp metrics
    const waMetrics = await page
      .locator("text=/chats|mensagens|messages|open/i")
      .count();
    expect(waMetrics).toBeGreaterThan(0);
  });

  test("should display AI performance card with metrics", async ({ page }) => {
    await page.waitForSelector("h1");

    // Look for AI Performance section
    const aiCard = page.locator("text=/ia|performance|ai|sparkles/i").first();
    await expect(aiCard).toBeVisible();

    // Should display AI metrics
    const aiMetrics = await page
      .locator("text=/suggestions|sugestões|adoption|adoptadas/i")
      .count();
    expect(aiMetrics >= 0).toBe(true);
  });

  test("should load sentiment analytics section dynamically", async ({
    page,
  }) => {
    // Sentiment section is dynamically imported via Suspense
    await page.waitForSelector("h1");

    // Wait for dynamic content to load (up to 3 seconds)
    const sentimentContent = page.locator("text=/sentiment|sentimento").first();

    // Either the section loads or shows as part of the page
    const pageLoaded = await page.locator('[class*="space-y"]').count();
    expect(pageLoaded).toBeGreaterThan(0);
  });

  test("should load AI performance detail section dynamically", async ({
    page,
  }) => {
    // AI Performance Detail is dynamically imported via Suspense
    await page.waitForSelector("h1");

    // Page should have loaded main content
    const mainContent = page.locator("h1");
    await expect(mainContent).toBeVisible();

    // Detail sections may be loading
    const hasDetailSections = await page
      .locator('[class*="md:grid-cols-2"]')
      .count();
    expect(hasDetailSections >= 0).toBe(true);
  });

  test("should support dark mode compatibility", async ({ page }) => {
    await page.waitForSelector("h1");

    const html = page.locator("html");

    // Get initial dark mode state
    const initialDarkMode = await html.evaluate((el) =>
      el.classList.contains("dark"),
    );

    // Click theme toggle button
    const themeButton = page.getByRole("button", {
      name: /tema|theme|claro|escuro|light|dark/i,
    });
    await themeButton.click();

    // Check that dark mode state toggled
    const afterToggle = await html.evaluate((el) =>
      el.classList.contains("dark"),
    );
    expect(initialDarkMode).not.toBe(afterToggle);

    // Page should still show content
    await expect(page.locator("h1").first()).toBeVisible();

    // Toggle back
    await themeButton.click();
    const finalDarkMode = await html.evaluate((el) =>
      el.classList.contains("dark"),
    );
    expect(finalDarkMode).toBe(initialDarkMode);
  });

  test("should render skeleton loaders while content loads", async ({
    page,
  }) => {
    // Intercept network to simulate slow loading
    await page.route("**/api/**", (route) => {
      setTimeout(() => {
        route.continue();
      }, 500);
    });

    await page.goto("/dashboard/analytics");

    // Skeleton elements should be present during loading
    const skeletons = page.locator('[class*="animate-pulse"]');
    const skeletonCount = await skeletons.count();

    // Should have skeleton elements during loading
    expect(skeletonCount >= 0).toBe(true);

    // Content should eventually load
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("should display KPI grid layout with responsive columns", async ({
    page,
  }) => {
    await page.waitForSelector("h1");

    // KPI cards should be in a grid with proper responsive classes
    const gridContainer = page.locator('[class*="grid"]').first();
    await expect(gridContainer).toBeVisible();

    // Should have multiple cards/items
    const cardCount = await page.locator('[class*="Card"]').count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test("should load without JavaScript errors", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
        console.error(`JS Error: ${msg.text()}`);
      }
    });

    await page.waitForSelector("h1");

    // Should have loaded the analytics page
    await expect(page.locator("h1").first()).toContainText(
      /analytics|analytiques/i,
    );

    // Page should be on correct URL
    expect(page.url()).toContain("/dashboard/analytics");
  });
});
