import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: 'html',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: [
    // customer-web (the SUT). CI runs a production build — Next.js dev
    // mode JIT-compiles each route on first request and on the GitHub
    // runner exceeds the 30s page.goto timeout.
    {
      command: isCI
        ? 'pnpm build && pnpm exec next start --port 3000'
        : 'pnpm exec next dev --port 3000',
      port: 3000,
      reuseExistingServer: !isCI,
      timeout: 180_000,
    },
    // staff-web hosts the /api/v1/customer/* routes that customer-web
    // POSTs to (waiter-calls, feedback, orders/place). Without this,
    // any test that triggers a mutation through `apiRoutes` gets a
    // connection-refused on http://localhost:3001 and the failure
    // surfaces as "no success toast" — the actual request never lands.
    {
      command: isCI
        ? 'cd ../staff-web && pnpm build && pnpm exec next start --port 3001'
        : 'cd ../staff-web && pnpm exec next dev --port 3001',
      port: 3001,
      reuseExistingServer: !isCI,
      timeout: 180_000,
    },
  ],
});
