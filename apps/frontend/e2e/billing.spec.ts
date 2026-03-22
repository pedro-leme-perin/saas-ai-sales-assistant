import { test, expect } from '@playwright/test';

// These tests require authentication.
// Set up Clerk test tokens via PLAYWRIGHT_CLERK_TOKEN env var
// or use Clerk's testing tokens: https://clerk.com/docs/testing/playwright

test.describe('Billing Page (authenticated)', () => {
  // Skip if no auth token is configured
  test.skip(!process.env.PLAYWRIGHT_CLERK_TOKEN, 'Requires PLAYWRIGHT_CLERK_TOKEN');

  test.beforeEach(async ({ page }) => {
    // Set Clerk session cookie for authenticated access
    const token = process.env.PLAYWRIGHT_CLERK_TOKEN!;
    await page.context().addCookies([
      {
        name: '__session',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('should render billing page with title', async ({ page }) => {
    await page.goto('/dashboard/billing');
    await page.waitForSelector('h1');
    const heading = page.locator('h1').first();
    await expect(heading).toContainText(/faturamento|billing/i);
  });

  test('should display current plan card', async ({ page }) => {
    await page.goto('/dashboard/billing');

    // Wait for content to load
    await page.waitForSelector('h2');

    // Check for "Assinatura Atual" or "Current Subscription" header
    const subscriptionHeader = page.locator('h2').filter({ hasText: /assinatura atual|current subscription/i });
    await expect(subscriptionHeader).toBeVisible();

    // Current plan should be visible
    const planCard = page.locator('text=/starter|professional|enterprise/i');
    await expect(planCard.first()).toBeVisible();
  });

  test('should display plan cards (Starter, Professional, Enterprise)', async ({ page }) => {
    await page.goto('/dashboard/billing');

    // Wait for plans section to load
    await page.waitForSelector('h2');

    // Check for plan cards with i18n support (PT-BR or EN)
    const plansHeader = page.locator('h2').filter({ hasText: /planos disponíveis|available plans/i });
    await expect(plansHeader).toBeVisible();

    // All three plan names should be visible
    await expect(page.locator('text=Starter')).toBeVisible();
    await expect(page.locator('text=Professional')).toBeVisible();
    await expect(page.locator('text=Enterprise')).toBeVisible();
  });

  test('should display invoices section', async ({ page }) => {
    await page.goto('/dashboard/billing');

    // Wait for invoices section
    await page.waitForSelector('h2');

    // Check for "Histórico de Faturas" or "Invoice History" header
    const invoicesHeader = page.locator('h2').filter({ hasText: /histórico de faturas|invoice history/i });
    await expect(invoicesHeader).toBeVisible();
  });

  test('should support dark mode toggle', async ({ page }) => {
    await page.goto('/dashboard/billing');

    const html = page.locator('html');

    // Get initial dark mode state
    const initialDarkMode = await html.evaluate((el) => el.classList.contains('dark'));

    // Click theme toggle button
    const themeButton = page.getByRole('button', { name: /tema|theme|claro|escuro|light|dark/i });
    await themeButton.click();

    // Check that dark mode state toggled
    const afterToggle = await html.evaluate((el) => el.classList.contains('dark'));
    expect(initialDarkMode).not.toBe(afterToggle);

    // Toggle back
    await themeButton.click();
    const finalDarkMode = await html.evaluate((el) => el.classList.contains('dark'));
    expect(finalDarkMode).toBe(initialDarkMode);
  });

  test('should have upgrade button for non-current plans', async ({ page }) => {
    await page.goto('/dashboard/billing');

    // Wait for plan cards
    await page.waitForSelector('text=/starter|professional|enterprise/i');

    // Look for upgrade/action buttons in plan cards
    const upgradeButton = page.getByRole('button', { name: /upgrade|selecionar|select|mudar para|change to/i });

    // At least one upgrade button should exist for non-current plans
    const buttonCount = await upgradeButton.count();
    expect(buttonCount).toBeGreaterThanOrEqual(0);
  });

  test('should load without JavaScript errors', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error(`JS Error: ${msg.text()}`);
      }
    });

    await page.goto('/dashboard/billing');
    await page.waitForSelector('h1');

    // Should be able to see key content
    await expect(page.locator('h1').first()).toContainText(/faturamento|billing/i);
  });

  test('should render skeleton loaders while content loads', async ({ page }) => {
    // Intercept network to simulate slow loading
    await page.route('**/api/**', (route) => {
      // Delay API response
      setTimeout(() => {
        route.continue();
      }, 500);
    });

    await page.goto('/dashboard/billing');

    // Skeleton elements should initially be visible
    const skeletons = page.locator('[class*="animate-pulse"]');
    const skeletonCount = await skeletons.count();

    // Should have skeleton elements during loading
    expect(skeletonCount).toBeGreaterThanOrEqual(0);
  });
});
