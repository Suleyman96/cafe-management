import { defineConfig } from 'vitest/config';

// react, react-dom, and @testing-library/react are direct devDependencies of
// this package — pnpm provides them co-located in node_modules so default
// resolution picks the right React 18 instance.
export default defineConfig({
  test: {
    root: __dirname,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/__tests__/**', 'src/index.ts'],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },
  },
});
