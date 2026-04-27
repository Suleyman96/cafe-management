import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    root: resolve(__dirname),
    globals: true,
    environment: 'jsdom',
    setupFiles: [resolve(__dirname, './src/__tests__/setup.ts')],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/e2e/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/hooks/**/*.ts', 'src/components/modals/**/*.tsx'],
      thresholds: {
        statements: 24,
        branches: 20,
        functions: 23,
        lines: 25,
      },
    },
    server: {
      deps: {
        inline: ['@testing-library/react'],
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      react: resolve(__dirname, './node_modules/react'),
      'react-dom': resolve(__dirname, './node_modules/react-dom'),
      'react/jsx-runtime': resolve(__dirname, './node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': resolve(__dirname, './node_modules/react/jsx-dev-runtime'),
    },
  },
});
