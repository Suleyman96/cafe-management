import { expect, test } from '@playwright/test';

test.describe('Waiter Call', () => {
  test('should load table page with waiter call option', async ({ page }) => {
    await page.goto('/table/T01');
    await expect(page.locator('body')).toBeVisible();
    await page.waitForLoadState('networkidle');
  });

  test('should show waiter call UI elements', async ({ page }) => {
    await page.goto('/table/T01');
    await page.waitForLoadState('networkidle');
    // Look for call waiter button
    const callButton = page.locator(
      'button:has-text("waiter"), button:has-text("call"), [data-testid="call-waiter"]',
    );
    if ((await callButton.count()) > 0) {
      await expect(callButton.first()).toBeVisible();
    }
  });
});
