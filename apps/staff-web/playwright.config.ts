import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  webServer: {
    // CI runs against a production build — `next dev` JIT-compiles each
    // route on first request and exceeds the GitHub runner's `page.goto`
    // timeout. Production builds serve pre-compiled routes in <100ms.
    // The explicit `--port 3001` decouples E2E from `package.json`'s
    // `dev` port (which can drift for local-dev ergonomics without
    // breaking CI).
    command: isCI
      ? 'pnpm build && pnpm exec next start --port 3001'
      : 'pnpm exec next dev --port 3001',
    port: 3001,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
