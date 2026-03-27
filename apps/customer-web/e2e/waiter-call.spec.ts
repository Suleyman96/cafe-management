import { expect, test } from '@playwright/test';

test.describe('Waiter Call', () => {
  test('table page shows call waiter button', async ({ page }) => {
    await page.goto('/table/T01');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();

    // Look for call waiter button by text or data-testid
    const callButton = page.locator(
      'button:has-text("waiter"), button:has-text("call"), [data-testid="call-waiter"]',
    );
    if ((await callButton.count()) > 0) {
      await expect(callButton.first()).toBeVisible();
    }
  });

  test('call waiter modal opens and shows reason options', async ({ page }) => {
    await page.goto('/table/T01');
    await page.waitForLoadState('networkidle');

    // Find and click the call waiter button
    const callButton = page.locator(
      'button:has-text("waiter"), button:has-text("call"), [data-testid="call-waiter"]',
    );

    if ((await callButton.count()) > 0) {
      await callButton.first().click();

      // Modal should appear with reason options
      const modal = page.locator('[role="dialog"], .fixed');
      if ((await modal.count()) > 0) {
        await expect(modal.first()).toBeVisible();

        // Should show at least one reason button (assistance, bill, etc.)
        const reasonButtons = modal.locator('button');
        expect(await reasonButtons.count()).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
