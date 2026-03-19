import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    exclude: ['**/e2e/**', '**/node_modules/**', 'apps/staff-web/**', 'apps/mobile/**'],
    coverage: {
      provider: 'v8',
    },
  },
});
