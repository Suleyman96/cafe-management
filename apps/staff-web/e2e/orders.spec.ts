import { expect, test } from '@playwright/test';

test.describe('Orders Page', () => {
  test('should load orders page or redirect to login', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display the app root page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);
  });

  test('should load kitchen page or redirect', async ({ page }) => {
    await page.goto('/kitchen');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});
