import { expect, test } from '@playwright/test';

test.describe('Waiter Call', () => {
  test('table page shows call staff FAB', async ({ page }) => {
    await page.goto('/table/T01');
    await page.waitForLoadState('networkidle');

    const fab = page.getByTestId('call-staff-fab');
    await expect(fab).toBeVisible({ timeout: 10000 });
    await expect(fab).toBeEnabled({ timeout: 10000 });
  });

  test('clicking call staff FAB triggers a success toast', async ({ page }) => {
    await page.goto('/table/T01');
    await page.waitForLoadState('networkidle');

    const fab = page.getByTestId('call-staff-fab');
    // Wait for the table to resolve so the FAB is enabled (handler bails
    // early when actualTableId is empty).
    await expect(fab).toBeEnabled({ timeout: 10000 });
    await fab.click();

    // sonner renders success toasts with role="status"; the i18n key
    // resolves to "Staff has been notified!" in en or "スタッフに通知されました！"
    // in ja depending on cafe settings load order. Match either.
    const toast = page.getByText(/staff has been notified|スタッフに通知されました/i);
    await expect(toast.first()).toBeVisible({ timeout: 10000 });
  });
});
