import { test as base, expect, type Page } from '@playwright/test';

/**
 * Hydration-safe login helper. The login form is a React-controlled client
 * component — after SSR, the input fields are visible immediately but React's
 * `onChange` handlers attach only after the JS bundle hydrates. If `page.fill`
 * runs before hydration, the typed values land in the DOM but React's
 * `email`/`password` state stays empty, so `disabled={!isValid}` on the submit
 * button never flips. Under `next dev` the JIT-compile pause used to mask
 * this; the production-build CI path (`next start`) serves SSR'd HTML faster
 * than hydration completes and exposes the race.
 *
 * The fix is a poll: re-fill until the submit button reports enabled, which
 * is the observable signal that React has picked up the controlled-input
 * change. Then click.
 */
export async function loginAs(page: Page, email: string, password: string) {
  await expect(async () => {
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
  await page.click('button[type="submit"]');
}

export const test = base.extend<{ staffPage: Page }>({
  staffPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/login');
    await loginAs(page, 'admin@test.com', 'test1234');

    // Wait for redirect away from login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
