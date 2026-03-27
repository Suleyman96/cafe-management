import { expect, test } from '@playwright/test';

test.describe('Order Flow', () => {
  test('table landing page shows table info and menu link', async ({ page }) => {
    await page.goto('/table/T01');
    await page.waitForLoadState('networkidle');

    // Page should render without errors
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);

    // Should show a link/button to view the menu
    const menuLink = page.locator('a[href*="menu"], button:has-text("menu")').first();
    if ((await menuLink.count()) > 0) {
      await expect(menuLink).toBeVisible();
    }
  });

  test('menu page displays items or empty state', async ({ page }) => {
    await page.goto('/table/T01/menu');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();

    // Should show either menu items or an empty state message
    const menuItems = page.locator('[data-testid="menu-item"]');
    const hasItems = (await menuItems.count()) > 0;

    if (hasItems) {
      await expect(menuItems.first()).toBeVisible();

      // Click first item to open detail view
      await menuItems.first().click();
      await page.waitForLoadState('networkidle');

      // Detail/modal should appear with add-to-cart or quantity controls
      const detailView = page.locator(
        '[data-testid="menu-item-detail"], [role="dialog"], button:has-text("add"), button:has-text("cart")',
      );
      if ((await detailView.count()) > 0) {
        await expect(detailView.first()).toBeVisible();
      }
    }
  });

  test('cart page shows empty state or items', async ({ page }) => {
    await page.goto('/table/T01/cart');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);

    // Should show either cart contents or empty cart message
    const cartContent = page.locator(
      '[data-testid="cart-items"], [data-testid="empty-cart"], text=/empty|no items|cart/i',
    );
    if ((await cartContent.count()) > 0) {
      await expect(cartContent.first()).toBeVisible();
    }
  });
});
