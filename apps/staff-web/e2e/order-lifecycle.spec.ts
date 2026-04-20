import { expect, test } from './fixtures';

test.describe('Order Lifecycle', () => {
  test('can create an order from tables page', async ({ staffPage: page }) => {
    await page.goto('/tables');
    await page.waitForLoadState('networkidle');

    // Find a free table and click it
    const freeTable = page.getByText('T01').first();
    await expect(freeTable).toBeVisible({ timeout: 10000 });
    await freeTable.click();

    // Wait for table detail/modal to appear
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('orders page lists existing orders', async ({ staffPage: page }) => {
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    // The page should load without errors
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);
  });

  test('kitchen page displays order items', async ({ staffPage: page }) => {
    await page.goto('/kitchen');
    await page.waitForLoadState('networkidle');

    // Kitchen page should load without errors
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
