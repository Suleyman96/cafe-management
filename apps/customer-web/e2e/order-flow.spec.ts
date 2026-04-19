import { expect, test } from '@playwright/test';

test.describe('Customer Order Flow', () => {
  test('table page loads and renders without errors', async ({ page }) => {
    await page.goto('/table/T01');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);
  });

  test('menu page displays categories from seed data', async ({ page }) => {
    await page.goto('/table/T01/menu');
    await page.waitForLoadState('networkidle');

    // Seed data has 5 categories — at least one should appear
    const categoryText = page.getByText(/Hot Drinks|Cold Drinks|Rice|Sushi|Desserts/);
    await expect(categoryText.first()).toBeVisible({ timeout: 10000 });
  });

  test('menu page displays menu items from seed data', async ({ page }) => {
    await page.goto('/table/T01/menu');
    await page.waitForLoadState('networkidle');

    // Seed data items should appear
    const menuItem = page.getByText(/Matcha Latte|Tonkotsu Ramen|Cappuccino/);
    await expect(menuItem.first()).toBeVisible({ timeout: 10000 });
  });

  test('cart page handles empty state', async ({ page }) => {
    await page.goto('/table/T01/cart');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);
  });
});
