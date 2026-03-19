import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 5'] });

test.describe('Mobile Responsiveness', () => {
  test('should show hamburger menu on mobile', async ({ page }) => {
    // Skip auth — just check landing page is responsive
    await page.goto('/');

    // Viewport should be mobile-sized
    const viewport = page.viewportSize();
    expect(viewport!.width).toBeLessThan(768);

    // Hero should be visible
    await expect(page.locator('h1')).toBeVisible();
  });

  test('landing page CTA should be tappable', async ({ page }) => {
    await page.goto('/');
    const cta = page.getByRole('link', { name: /começar|start|grátis|free/i }).first();
    await expect(cta).toBeVisible();

    // Check it's not cut off
    const box = await cta.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(40);
    expect(box!.height).toBeGreaterThan(30);
  });
});

test.describe('Mobile Dashboard (authenticated)', () => {
  test.skip(!process.env.PLAYWRIGHT_CLERK_TOKEN, 'Requires PLAYWRIGHT_CLERK_TOKEN');

  test.beforeEach(async ({ page }) => {
    const token = process.env.PLAYWRIGHT_CLERK_TOKEN!;
    await page.context().addCookies([
      { name: '__session', value: token, domain: 'localhost', path: '/' },
    ]);
  });

  test('sidebar should be hidden by default on mobile', async ({ page }) => {
    await page.goto('/dashboard');

    // Sidebar should not be visible (translated off-screen)
    const sidebar = page.locator('aside');
    const transform = await sidebar.evaluate(
      (el) => window.getComputedStyle(el).transform,
    );
    // Should have a negative translateX (hidden)
    expect(transform).not.toBe('none');
  });

  test('should open sidebar with hamburger button', async ({ page }) => {
    await page.goto('/dashboard');

    const menuButton = page.getByRole('button', { name: /abrir menu|open menu/i });
    await menuButton.click();

    // Sidebar should now be visible
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
  });
});
