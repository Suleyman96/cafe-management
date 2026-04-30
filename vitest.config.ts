import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    exclude: [
      '**/e2e/**',
      '**/node_modules/**',
      '**/rls/**',
      'apps/staff-web/**',
      'apps/mobile/**',
      'apps/customer-web/**',
      // Packages with their own vitest.config.ts (different React resolution).
      // They are run separately via the root `pnpm test` script.
      'packages/queries/**',
      'packages/ui/**',
      'packages/ui-web/**',
      'packages/i18n/**',
    ],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 55,
        lines: 60,
      },
    },
  },
});
