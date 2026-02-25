import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    exclude: ['**/e2e/**', '**/node_modules/**', 'apps/staff-web/**'],
    coverage: {
      provider: 'v8',
    },
  },
});
