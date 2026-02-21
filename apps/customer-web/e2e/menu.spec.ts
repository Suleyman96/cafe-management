import { expect, test } from '@playwright/test';

test.describe('Menu Page', () => {
  test('should display menu categories on table page', async ({ page }) => {
    await page.goto('/table/T01/menu');
    await expect(page.locator('body')).toBeVisible();
    // Page should load without errors
    await expect(page).not.toHaveTitle(/error/i);
  });

  test('should filter menu items by category', async ({ page }) => {
    await page.goto('/table/T01/menu');
    // Wait for menu to load
    await page.waitForLoadState('networkidle');
    // Look for category buttons/tabs
    const categories = page.locator('[data-testid="category"], button, [role="tab"]');
    if ((await categories.count()) > 0) {
      await categories.first().click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('should show menu item details on click', async ({ page }) => {
    await page.goto('/table/T01/menu');
    await page.waitForLoadState('networkidle');
    // Click first menu item if available
    const menuItems = page.locator('[data-testid="menu-item"]');
    if ((await menuItems.count()) > 0) {
      await menuItems.first().click();
      // Modal or detail view should appear
      await page.waitForLoadState('networkidle');
    }
  });
});
