import { expect, test } from '@playwright/test';

test.describe('Order Flow', () => {
  test('should navigate to cart page', async ({ page }) => {
    await page.goto('/table/T01/cart');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);
  });

  test('should navigate to order status page', async ({ page }) => {
    await page.goto('/table/T01/order');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);
  });

  test('should load table landing page', async ({ page }) => {
    await page.goto('/table/T01');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);
  });
});
