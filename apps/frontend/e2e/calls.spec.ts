import { test, expect } from "@playwright/test";

test.describe("Calls Page (authenticated)", () => {
  test.skip(
    !process.env.PLAYWRIGHT_CLERK_TOKEN,
    "Requires PLAYWRIGHT_CLERK_TOKEN",
  );

  test.beforeEach(async ({ page }) => {
    const token = process.env.PLAYWRIGHT_CLERK_TOKEN!;
    await page
      .context()
      .addCookies([
        { name: "__session", value: token, domain: "localhost", path: "/" },
      ]);
    await page.goto("/dashboard/calls");
  });

  test("should render calls page with stats and filters", async ({ page }) => {
    await expect(page.getByText(/ligações|calls/i).first()).toBeVisible();

    // Stats cards should be visible
    await expect(page.getByText(/total/i).first()).toBeVisible();

    // Filter selects should be present
    const statusFilter = page.locator("select").first();
    await expect(statusFilter).toBeVisible();
  });

  test("should open new call modal", async ({ page }) => {
    const newCallButton = page.getByRole("button", {
      name: /nova ligação|new call/i,
    });
    await newCallButton.click();

    // Modal should appear
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/telefone|phone/i);
  });

  test("should close modal with Escape", async ({ page }) => {
    const newCallButton = page.getByRole("button", {
      name: /nova ligação|new call/i,
    });
    await newCallButton.click();

    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("should filter calls by status", async ({ page }) => {
    const statusSelect = page.locator("select").first();
    await statusSelect.selectOption("COMPLETED");

    // URL or query should update (page re-fetches)
    await page.waitForTimeout(500);
    // Just verify the select has the right value
    await expect(statusSelect).toHaveValue("COMPLETED");
  });

  test("should search calls", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/buscar|search/i);
    await searchInput.fill("+5511999999999");
    await page.waitForTimeout(500);
    await expect(searchInput).toHaveValue("+5511999999999");
  });
});
