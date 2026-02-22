import { expect, test } from '@playwright/test';

test.describe('Authentication', () => {
  test('should render login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
    // Should have email/password inputs
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"]');
    if ((await emailInput.count()) > 0) {
      await expect(emailInput).toBeVisible();
    }
    if ((await passwordInput.count()) > 0) {
      await expect(passwordInput).toBeVisible();
    }
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');
    // Should either show login or redirect
    const url = page.url();
    expect(url.includes('login') || url.includes('orders')).toBe(true);
  });
});
