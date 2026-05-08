import { expect, test } from '@playwright/test';
import { loginAs } from './fixtures';

test.describe('Authentication', () => {
  test('login page renders with email and password fields', async ({ page }) => {
    await page.goto('/login', { timeout: 60000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForURL('**/login**');
    expect(page.url()).toContain('/login');
  });

  test('admin can log in and reach the dashboard', async ({ page }) => {
    await page.goto('/login');
    await loginAs(page, 'admin@test.com', 'test1234');

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    expect(page.url()).not.toContain('/login');
  });

  test('invalid credentials stay on login page', async ({ page }) => {
    await page.goto('/login');
    await loginAs(page, 'admin@test.com', 'wrongpassword');

    // Should stay on login page
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/login');
  });
});
