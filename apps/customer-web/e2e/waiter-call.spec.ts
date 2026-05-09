import { expect, test } from '@playwright/test';

test.describe('Waiter Call', () => {
  test('table page shows call staff FAB', async ({ page }) => {
    await page.goto('/table/T01');
    await page.waitForLoadState('networkidle');

    const fab = page.getByTestId('call-staff-fab');
    await expect(fab).toBeVisible({ timeout: 10000 });
    await expect(fab).toBeEnabled({ timeout: 10000 });
  });

  test('clicking call staff FAB posts to the waiter-calls endpoint with success', async ({
    page,
  }) => {
    // Surface browser-side errors in the trace — silent failures here used
    // to leave us guessing why the toast didn't render in CI.
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/table/T01');
    await page.waitForLoadState('networkidle');

    const fab = page.getByTestId('call-staff-fab');
    // Wait for the table to resolve so the FAB is enabled (handler bails
    // early when actualTableId is empty).
    await expect(fab).toBeEnabled({ timeout: 10000 });

    // Assert against the network response, not a localized toast. Toast
    // text matching depended on the customer i18n bundle being loaded
    // before the click — a slow bundle made the test flake even when
    // the API call succeeded. The POST returning 2xx is the direct
    // signal that the click handler ran and the server accepted it.
    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/customer/waiter-calls') && resp.request().method() === 'POST',
      { timeout: 15000 },
    );
    await fab.click();
    const response = await responsePromise;

    if (response.status() >= 400) {
      const body = await response.text().catch(() => '<unreadable>');
      throw new Error(
        `waiter-calls POST returned ${response.status()}: ${body}\nconsole errors: ${consoleErrors.join(' | ')}`,
      );
    }
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
  });
});
