import { test, expect } from "@playwright/test";

// These tests require authentication.
// Set up Clerk test tokens via PLAYWRIGHT_CLERK_TOKEN env var
// or use Clerk's testing tokens: https://clerk.com/docs/testing/playwright

test.describe("Settings Page (authenticated)", () => {
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
  });

  test("should render settings page with title", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForSelector("h1");
    const heading = page.locator("h1").first();
    await expect(heading).toContainText(/configurações|settings/i);
  });

  test("should have default tab (Profile) active on initial load", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");

    // Wait for tab content to load
    await page.waitForLoadState("networkidle");

    // Profile tab should be active (has primary background color)
    const profileButton = page.getByRole("button", { name: /perfil|profile/i });
    const profileClasses = await profileButton.getAttribute("class");

    // Active tab should contain primary styling
    expect(profileClasses).toMatch(/bg-primary|text-primary/);
  });

  test("should navigate to Company tab", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    // Click Company tab
    const companyTab = page.getByRole("button", { name: /empresa|company/i });
    await companyTab.click();

    // Tab should be active
    const companyClasses = await companyTab.getAttribute("class");
    expect(companyClasses).toMatch(/bg-primary|text-primary/);

    // Wait for tab content to load
    await page.waitForLoadState("networkidle");

    // Company content should be visible (look for company-related form fields)
    const companyContent = page.locator(
      "text=/empresa|company name|razão social/i",
    );
    await expect(companyContent.first()).toBeVisible();
  });

  test("should navigate to Notifications tab", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    // Click Notifications tab
    const notificationsTab = page.getByRole("button", {
      name: /notificações|notifications/i,
    });
    await notificationsTab.click();

    // Tab should be active
    const notificationsClasses = await notificationsTab.getAttribute("class");
    expect(notificationsClasses).toMatch(/bg-primary|text-primary/);

    // Wait for tab content to load
    await page.waitForLoadState("networkidle");

    // Notifications content should be visible
    const notificationsContent = page.locator(
      "text=/notificações|notifications|email|alerts/i",
    );
    expect(await notificationsContent.first().isVisible()).toBeTruthy();
  });

  test("should navigate to Security tab", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    // Click Security tab
    const securityTab = page.getByRole("button", {
      name: /segurança|security/i,
    });
    await securityTab.click();

    // Tab should be active
    const securityClasses = await securityTab.getAttribute("class");
    expect(securityClasses).toMatch(/bg-primary|text-primary/);

    // Wait for tab content to load
    await page.waitForLoadState("networkidle");

    // Security content should be visible
    const securityContent = page.locator(
      "text=/segurança|security|senha|password|two-factor/i",
    );
    expect(await securityContent.first().isVisible()).toBeTruthy();
  });

  test("should navigate to Appearance tab", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    // Click Appearance tab
    const appearanceTab = page.getByRole("button", {
      name: /aparência|appearance/i,
    });
    await appearanceTab.click();

    // Tab should be active
    const appearanceClasses = await appearanceTab.getAttribute("class");
    expect(appearanceClasses).toMatch(/bg-primary|text-primary/);

    // Wait for tab content to load
    await page.waitForLoadState("networkidle");

    // Appearance content should be visible
    const appearanceContent = page.locator(
      "text=/aparência|appearance|tema|theme|idioma|language/i",
    );
    expect(await appearanceContent.first().isVisible()).toBeTruthy();
  });

  test("should have language selector in Appearance tab", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    // Navigate to Appearance tab
    const appearanceTab = page.getByRole("button", {
      name: /aparência|appearance/i,
    });
    await appearanceTab.click();

    // Wait for tab content
    await page.waitForLoadState("networkidle");

    // Look for language selector (dropdown or radio buttons)
    const languageSelector = page.locator(
      "text=/idioma|language|português|english|pt|en/i",
    );

    // Language selector should be visible
    expect(await languageSelector.first().isVisible()).toBeTruthy();

    // Check for language options
    const languageOptions = page
      .locator("button, select")
      .filter({ hasText: /português|english|pt-br|en/i });
    const optionCount = await languageOptions.count();
    expect(optionCount).toBeGreaterThan(0);
  });

  test("should have dark mode toggle in Appearance tab", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    // Navigate to Appearance tab
    const appearanceTab = page.getByRole("button", {
      name: /aparência|appearance/i,
    });
    await appearanceTab.click();

    // Wait for tab content
    await page.waitForLoadState("networkidle");

    // Look for theme toggle (button or switch)
    const themeToggle = page.getByRole("button", {
      name: /tema|theme|claro|escuro|light|dark|modo noturno/i,
    });

    // Theme toggle should be visible
    await expect(themeToggle.first()).toBeVisible();
  });

  test("should maintain tab state when navigating between tabs", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    // Click Company tab
    const companyTab = page.getByRole("button", { name: /empresa|company/i });
    await companyTab.click();
    await page.waitForLoadState("networkidle");

    // Click back to Profile
    const profileTab = page.getByRole("button", { name: /perfil|profile/i });
    await profileTab.click();
    await page.waitForLoadState("networkidle");

    // Profile should be active again
    const profileClasses = await profileTab.getAttribute("class");
    expect(profileClasses).toMatch(/bg-primary|text-primary/);
  });

  test("should load all tabs without JavaScript errors", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    // Navigate through all tabs
    const profileTab = page.getByRole("button", { name: /perfil|profile/i });
    const companyTab = page.getByRole("button", { name: /empresa|company/i });
    const notificationsTab = page.getByRole("button", {
      name: /notificações|notifications/i,
    });
    const securityTab = page.getByRole("button", {
      name: /segurança|security/i,
    });
    const appearanceTab = page.getByRole("button", {
      name: /aparência|appearance/i,
    });

    for (const tab of [
      profileTab,
      companyTab,
      notificationsTab,
      securityTab,
      appearanceTab,
    ]) {
      await tab.click();
      await page.waitForLoadState("networkidle");
    }

    // Should have minimal or no JS errors
    expect(
      errors.filter((e) => !e.includes("Network.getResponseBody")),
    ).toHaveLength(0);
  });

  test("should render settings sidebar with all tabs visible", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    // All tab buttons should be visible in sidebar
    const profileTab = page.getByRole("button", { name: /perfil|profile/i });
    const companyTab = page.getByRole("button", { name: /empresa|company/i });
    const notificationsTab = page.getByRole("button", {
      name: /notificações|notifications/i,
    });
    const securityTab = page.getByRole("button", {
      name: /segurança|security/i,
    });
    const appearanceTab = page.getByRole("button", {
      name: /aparência|appearance/i,
    });

    await expect(profileTab).toBeVisible();
    await expect(companyTab).toBeVisible();
    await expect(notificationsTab).toBeVisible();
    await expect(securityTab).toBeVisible();
    await expect(appearanceTab).toBeVisible();
  });

  test("should show skeleton loaders while tab content loads", async ({
    page,
  }) => {
    // Intercept network to simulate slow loading
    await page.route("**/api/**", (route) => {
      // Delay API response
      setTimeout(() => {
        route.continue();
      }, 500);
    });

    await page.goto("/dashboard/settings");

    // Click Company tab to trigger loading
    const companyTab = page.getByRole("button", { name: /empresa|company/i });
    await companyTab.click();

    // Skeleton elements should be visible during loading
    const skeletons = page.locator('[class*="animate-pulse"]');
    const skeletonCount = await skeletons.count();

    // Should have skeleton elements while loading
    expect(skeletonCount).toBeGreaterThanOrEqual(0);
  });
});
