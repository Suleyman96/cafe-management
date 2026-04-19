import { expect, test } from './fixtures';

test.describe('Staff Pages (authenticated)', () => {
  test('orders page loads for authenticated user', async ({ staffPage: page }) => {
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);
  });

  test('tables page shows restaurant tables from seed data', async ({ staffPage: page }) => {
    await page.goto('/tables');
    await page.waitForLoadState('networkidle');
    // Seed data has 8 tables — at least T01 should appear
    const tableContent = page.getByText('T01');
    await expect(tableContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('kitchen page loads for authenticated user', async ({ staffPage: page }) => {
    await page.goto('/kitchen');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);
  });

  test('menu page loads for authenticated user', async ({ staffPage: page }) => {
    await page.goto('/menu');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/error/i);
  });
});
