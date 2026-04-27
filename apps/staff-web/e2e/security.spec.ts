import { expect, test } from '@playwright/test';

test.describe('Security', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated API request returns 401', async ({ request }) => {
    const response = await request.get('/api/v1/orders', {
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(401);
  });

  test('customer API endpoint is rate limited', async ({ request }) => {
    // Rate limiting requires Upstash Redis — skip when not configured (CI / local dev)
    test.skip(
      !process.env.UPSTASH_REDIS_REST_URL,
      'Rate limiting not enforced (Redis not configured)',
    );

    // Send many requests quickly to trigger rate limiting
    const requests = [];
    for (let i = 0; i < 35; i++) {
      requests.push(
        request.post('/api/v1/customer/orders', {
          data: { invalid: 'data' },
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }

    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status());

    // At least some should be 429 (rate limited)
    const rateLimited = statuses.filter((s) => s === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  test('security headers are present', async ({ page }) => {
    const response = await page.goto('/login');
    const headers = response?.headers() || {};

    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['strict-transport-security']).toContain('max-age=');
  });
});
