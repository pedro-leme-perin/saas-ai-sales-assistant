import { test, expect } from "@playwright/test";

test.describe("Terms of Service Page", () => {
  test("should render terms page with heading", async ({ page }) => {
    await page.goto("/terms", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toContainText(
      /termos|terms|condi/i,
      { timeout: 10_000 },
    );
  });

  test("should contain key legal sections", async ({ page }) => {
    await page.goto("/terms", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 10_000 });

    const body = page.locator("body");
    await expect(body).toContainText(
      /uso do servi|use of service|acceptable use/i,
      {
        timeout: 10_000,
      },
    );
    await expect(body).toContainText(/pagamento|payment|billing/i, {
      timeout: 10_000,
    });
    await expect(body).toContainText(
      /propriedade intelectual|intellectual property/i,
      {
        timeout: 10_000,
      },
    );
  });

  test("should have proper meta/title", async ({ page }) => {
    await page.goto("/terms", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("title", { state: "attached", timeout: 10_000 });
    const title = await page.title();
    expect(title).toMatch(/termos|terms|TheIAdvisor/i);
  });

  test("should have navigation back to home", async ({ page }) => {
    await page.goto("/terms", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 10_000 });

    const homeLink = page
      .getByRole("link", { name: /home|in.cio|TheIAdvisor|voltar/i })
      .first();
    await expect(homeLink).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Privacy Policy Page", () => {
  test("should render privacy policy with heading", async ({ page }) => {
    await page.goto("/privacy", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toContainText(
      /privacidade|privacy/i,
      { timeout: 10_000 },
    );
  });

  test("should contain LGPD references", async ({ page }) => {
    await page.goto("/privacy", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 10_000 });

    const body = page.locator("body");
    await expect(body).toContainText(
      /LGPD|Lei Geral de Prote..o de Dados|General Data Protection|prote..o de dados/i,
      { timeout: 10_000 },
    );
  });

  test("should mention data controller info", async ({ page }) => {
    await page.goto("/privacy", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 10_000 });

    const body = page.locator("body");
    await expect(body).toContainText(
      /controlador|data controller|respons.vel|TheIAdvisor/i,
      { timeout: 10_000 },
    );
  });

  test("should have proper meta/title", async ({ page }) => {
    await page.goto("/privacy", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("title", { state: "attached", timeout: 10_000 });
    const title = await page.title();
    expect(title).toMatch(/privacidade|privacy|TheIAdvisor/i);
  });
});

test.describe("Help/FAQ Page", () => {
  test("should render help page with heading", async ({ page }) => {
    await page.goto("/help", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toContainText(
      /ajuda|help|FAQ|perguntas frequentes|suporte|support/i,
      {
        timeout: 10_000,
      },
    );
  });

  test("should have accordion/expandable FAQ items", async ({ page }) => {
    await page.goto("/help", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 10_000 });

    const expandable = page.locator(
      'button[aria-expanded], details, [data-state="closed"], [data-state="open"], [role="button"][aria-expanded]',
    );
    await expect(expandable.first()).toBeVisible({ timeout: 10_000 });

    await expandable.first().click();
    const expandedContent = page.locator(
      '[data-state="open"], details[open], [aria-expanded="true"]',
    );
    await expect(expandedContent.first()).toBeVisible({ timeout: 10_000 });
  });

  test("should contain multiple FAQ categories", async ({ page }) => {
    await page.goto("/help", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 10_000 });

    const categoryHeadings = page.locator("h2, h3");
    const count = await categoryHeadings.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("should have contact/support info", async ({ page }) => {
    await page.goto("/help", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 10_000 });

    const body = page.locator("body");
    await expect(body).toContainText(
      /contato|contact|suporte|support|email|team@theiadvisor/i,
      { timeout: 10_000 },
    );
  });
});
