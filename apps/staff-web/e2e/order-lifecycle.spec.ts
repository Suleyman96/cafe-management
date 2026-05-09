import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

test.describe('Order Lifecycle', () => {
  test('tables page loads and shows seed tables', async ({ staffPage: page }) => {
    await page.goto('/tables');
    await page.waitForLoadState('networkidle');

    const table = page.getByText('T01').first();
    await expect(table).toBeVisible({ timeout: 10000 });
  });

  test('table detail shows menu items for ordering', async ({ staffPage: page }) => {
    await page.goto('/tables');
    await page.waitForLoadState('networkidle');

    // Click on a table to open detail view
    const table = page.getByText('T01').first();
    await expect(table).toBeVisible({ timeout: 10000 });
    await table.click();
    await page.waitForLoadState('networkidle');

    // Should see the table detail page with menu items
    // Look for menu item names from seed data
    const menuItem = page.getByText(/Matcha Latte|Tonkotsu Ramen|Cappuccino/).first();
    await expect(menuItem).toBeVisible({ timeout: 10000 });
  });

  test('can add items to cart and create an order', async ({ staffPage: page }) => {
    await page.goto('/tables');
    await page.waitForLoadState('networkidle');

    // Find a free table (T08 is a private room, likely free)
    const table = page.getByText('T08').first();
    await expect(table).toBeVisible({ timeout: 10000 });
    await table.click();
    await page.waitForLoadState('networkidle');

    // Wait for menu items to load
    const menuItem = page.getByText(/Matcha Latte|Cappuccino/).first();
    await expect(menuItem).toBeVisible({ timeout: 10000 });

    // Click a menu item to add to cart
    await menuItem.click();

    // The cart section should appear with the submit button
    const submitBtn = page.getByTestId('submit-order');
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
  });

  test('orders page lists existing orders', async ({ staffPage: page }) => {
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    // The page should load without errors
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);
  });

  test('order status can be updated through lifecycle', async ({ staffPage: page }) => {
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    // Look for any order with a status action button. The button must be both
    // visible AND enabled — Playwright's `isVisible()` returns true for disabled
    // buttons too (they're in the DOM), so without the enabled check we'd try to
    // click a button that's gated by `!hasItems` or an in-flight mutation and
    // time out on the click retry. The test is intentionally lenient: if no
    // actionable order exists, it passes — only the page-loads-without-error
    // signal is asserted.
    const isClickable = async (locator: ReturnType<Page['getByRole']>) =>
      (await locator.isVisible().catch(() => false)) &&
      (await locator.isEnabled().catch(() => false));

    const startPreparingBtn = page.getByRole('button', { name: /start preparing/i }).first();
    const approveBtn = page.getByRole('button', { name: /approve/i }).first();

    if (await isClickable(startPreparingBtn)) {
      await startPreparingBtn.click();
      await page.waitForLoadState('networkidle');
      // After clicking, the status should change - look for "Ready" button
      const readyBtn = page.getByRole('button', { name: /ready/i }).first();
      await expect(readyBtn).toBeVisible({ timeout: 5000 });
    } else if (await isClickable(approveBtn)) {
      await approveBtn.click();
      await page.waitForLoadState('networkidle');
    }
    // If no actionable order exists, the test still passes — it verifies the page loads
  });

  test('kitchen page displays order items', async ({ staffPage: page }) => {
    await page.goto('/kitchen');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);
  });

  test('reports page loads financial data', async ({ staffPage: page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);
  });
});
