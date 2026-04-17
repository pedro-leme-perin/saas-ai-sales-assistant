import { test, expect } from '@playwright/test';

// These tests require authentication.
// Set up Clerk test tokens via PLAYWRIGHT_CLERK_TOKEN env var
// or use Clerk's testing tokens: https://clerk.com/docs/testing/playwright

test.describe('Dashboard (authenticated)', () => {
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

  test('should render dashboard with KPI cards', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('h1');
    await expect(page.locator('h1')).toContainText(/dashboard/i);
  });

  test('should navigate between pages via sidebar', async ({ page }) => {
    await page.goto('/dashboard');

    // Click on Calls
    await page.getByRole('link', { name: /ligações|calls/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/calls/);

    // Click on WhatsApp
    await page.getByRole('link', { name: /whatsapp/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/whatsapp/);

    // Click on Settings
    await page.getByRole('link', { name: /configurações|settings/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/settings/);
  });

  test('should toggle dark mode', async ({ page }) => {
    await page.goto('/dashboard');

    const html = page.locator('html');

    // Click theme toggle
    const themeButton = page.getByRole('button', { name: /tema|theme|claro|escuro|light|dark/i });
    await themeButton.click();

    // Check that class changed
    const hasDark = await html.evaluate((el) => el.classList.contains('dark'));
    // Toggle again
    await themeButton.click();
    const hasDarkAfter = await html.evaluate((el) => el.classList.contains('dark'));

    // Should have toggled
    expect(hasDark).not.toBe(hasDarkAfter);
  });

  test('should open notification panel', async ({ page }) => {
    await page.goto('/dashboard');

    const bellButton = page.getByRole('button', { name: /notificações|notifications/i });
    await bellButton.click();

    // Panel should be visible
    await expect(page.getByText(/notificações|notifications/i).first()).toBeVisible();
  });

  test('should show skip-to-content link on Tab', async ({ page }) => {
    await page.goto('/dashboard');

    // Press Tab to reveal skip link
    await page.keyboard.press('Tab');
    const skipLink = page.getByText(/ir para o conteúdo|skip to/i);
    await expect(skipLink).toBeVisible();
  });
});
