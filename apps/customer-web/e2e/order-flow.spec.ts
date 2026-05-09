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

  test('can add item to cart via quick-add button', async ({ page }) => {
    await page.goto('/table/T01/menu');
    await page.waitForLoadState('networkidle');

    // Wait for menu items to load
    await expect(page.getByText(/Matcha Latte|Tonkotsu Ramen|Cappuccino/).first()).toBeVisible({
      timeout: 10000,
    });

    // Click the first quick-add button
    const quickAddBtn = page.getByTestId('quick-add').first();
    await expect(quickAddBtn).toBeVisible({ timeout: 5000 });
    await quickAddBtn.click();

    // Cart is in-memory only (cart-store.ts: persistence dropped to fix
    // cross-table contamination), so `page.goto('/cart')` would do a
    // full reload and wipe state. Verify the add via the toast that
    // menu-item-card.tsx fires synchronously after `addItem`. Toast text
    // is `Added 1x <name> to cart` (en, customer.json:menuItem.addedToCart);
    // matching `/added .* to cart/i` keeps the assertion robust to count
    // and name interpolation.
    const toast = page.getByText(/added .* to cart/i).first();
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  test('cart page handles empty state', async ({ page }) => {
    // Use a different table to ensure empty cart
    await page.goto('/table/T02/cart');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);
  });

  test('menu item click opens detail modal', async ({ page }) => {
    await page.goto('/table/T01/menu');
    await page.waitForLoadState('networkidle');

    // Wait for items to load
    const menuItem = page.getByText(/Matcha Latte|Cappuccino/).first();
    await expect(menuItem).toBeVisible({ timeout: 10000 });

    // Click on the menu item card (not the quick-add button)
    await menuItem.click();

    // A modal/dialog should appear with item details
    // Look for "Add to Order" button text which appears in the modal
    const addToOrderBtn = page.getByRole('button', { name: /add to order/i });
    await expect(addToOrderBtn).toBeVisible({ timeout: 5000 });
  });

  test('can adjust quantity in item detail modal', async ({ page }) => {
    await page.goto('/table/T01/menu');
    await page.waitForLoadState('networkidle');

    const menuItem = page.getByText(/Matcha Latte|Cappuccino/).first();
    await expect(menuItem).toBeVisible({ timeout: 10000 });
    await menuItem.click();

    // Wait for modal to appear
    const addToOrderBtn = page.getByRole('button', { name: /add to order/i });
    await expect(addToOrderBtn).toBeVisible({ timeout: 5000 });

    // Click the plus button inside the open dialog. Using the testid keeps
    // us scoped to the modal — the menu cards behind the modal also render
    // a plus-icon button (data-testid="quick-add"), and an unscoped locator
    // would race with it and time out on the modal overlay.
    const plusBtn = page.getByTestId('modal-quantity-increase');
    await plusBtn.click();

    // Quantity should now be 2
    await expect(page.getByText('2')).toBeVisible();
  });
});
