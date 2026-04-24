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
