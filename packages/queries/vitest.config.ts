import { defineConfig } from 'vitest/config';

// react, react-dom, and @testing-library/react are direct devDependencies of
// this package, so pnpm gives us a co-located, version-correct copy in
// node_modules. No aliasing required — vitest's default resolution finds the
// right React 18 instance across @tanstack/react-query and the testing library.
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
