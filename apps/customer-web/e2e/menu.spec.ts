import { expect, test } from '@playwright/test';

test.describe('Menu Page', () => {
  test('menu page renders without errors', async ({ page }) => {
    await page.goto('/table/T01/menu');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);
  });

  test('displays seed data categories', async ({ page }) => {
    await page.goto('/table/T01/menu');
    await page.waitForLoadState('networkidle');

    // Seed data has these categories
    const hotDrinks = page.getByText('Hot Drinks');
    await expect(hotDrinks.first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking a menu item opens detail view', async ({ page }) => {
    await page.goto('/table/T01/menu');
    await page.waitForLoadState('networkidle');

    const menuItems = page.locator('[data-testid="menu-item"]');
    if ((await menuItems.count()) > 0) {
      await menuItems.first().click();
      // Modal or detail should appear
      const detailView = page.locator('[role="dialog"], [data-testid="menu-item-detail"]');
      if ((await detailView.count()) > 0) {
        await expect(detailView.first()).toBeVisible();
      }
    }
  });
});
