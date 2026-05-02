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
  webServer: {
    // CI runs against a production build — Next.js dev mode JIT-compiles
    // each route on first request which on the GitHub runner exceeds 30s
    // and times out `page.goto`. Production builds serve pre-compiled
    // routes in <100ms. Local dev keeps `pnpm dev` for HMR ergonomics.
    command: isCI ? 'pnpm build && pnpm start' : 'pnpm dev',
    port: 3000,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
