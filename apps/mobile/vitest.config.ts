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
    server: {
      deps: {
        inline: ['@testing-library/react', '@gustri/queries'],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/hooks/**/*.ts'],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@gustri/queries': resolve(__dirname, '../../packages/queries/src/index.ts'),
      '@sentry/react-native': resolve(__dirname, './src/__tests__/helpers/mock-sentry.ts'),
      '@tanstack/react-query': resolve(__dirname, './node_modules/@tanstack/react-query'),
      'react-native': resolve(__dirname, './src/__tests__/helpers/mock-react-native.ts'),
      react: resolve(__dirname, './node_modules/react'),
      'react-dom': resolve(__dirname, './node_modules/react-dom'),
      'react/jsx-runtime': resolve(__dirname, './node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': resolve(__dirname, './node_modules/react/jsx-dev-runtime'),
    },
  },
});
