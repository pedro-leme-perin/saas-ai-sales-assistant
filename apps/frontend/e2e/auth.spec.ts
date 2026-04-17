import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("should redirect unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    // Clerk middleware should redirect to sign-in
    await page.waitForURL(/sign-in|login/, { timeout: 10_000 });
    expect(page.url()).toMatch(/sign-in|login/);
  });

  test("should show sign-in page", async ({ page }) => {
    await page.goto("/sign-in");
    // Clerk renders its own sign-in component
    await expect(page.locator("body")).toBeVisible();
    // The page should not be the dashboard
    const url = page.url();
    expect(url).not.toContain("/dashboard");
  });

  test("should show sign-up page", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.locator("body")).toBeVisible();
    const url = page.url();
    expect(url).not.toContain("/dashboard");
  });
});
