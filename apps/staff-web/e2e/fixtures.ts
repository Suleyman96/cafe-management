import { test as base, type Page } from '@playwright/test';

export const test = base.extend<{ staffPage: Page }>({
  staffPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'test1234');
    await page.click('button[type="submit"]');

    // Wait for redirect away from login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
