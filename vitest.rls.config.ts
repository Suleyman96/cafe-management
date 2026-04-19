import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['packages/api-client/src/__tests__/rls/**/*.test.ts'],
    testTimeout: 30000,
  },
});
