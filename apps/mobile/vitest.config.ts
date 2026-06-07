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
        // `@gustri/ui-mobile` is inlined so its `react-native-paper` / `react-native`
        // imports go through the test's `vi.mock(...)` setup. Without inlining, the
        // workspace symlink is treated as an external dep and the mock is bypassed
        // when ui-mobile's components transitively require Paper internals.
        inline: ['@testing-library/react', '@gustri/queries', '@gustri/ui-mobile'],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/hooks/**/*.ts'],
      // Pure re-export barrels and one-line shared-hook re-exports are
      // exercised through the underlying `@gustri/queries` tests; counting
      // them in mobile coverage just dilutes the signal. Real mobile-local
      // logic (use-orders, use-realtime-sync, …) stays included.
      exclude: [
        'src/hooks/index.ts',
        'src/hooks/local.ts',
        'src/hooks/shared.ts',
        'src/hooks/use-feedback.ts',
        'src/hooks/use-takeout.ts',
        'src/hooks/use-waste.ts',
        'src/hooks/use-delivery.ts',
        'src/hooks/use-currency-symbol.ts',
      ],
      // Restored to the original floor (issue #200) after `use-push-token-sync`
      // got a full test suite — actual coverage is now ~70/55/80/71, comfortably
      // above this floor, so the floor both protects that new test (deleting it
      // drops below 58/37) and leaves headroom. `use-realtime-sync.ts` still has
      // uncovered branches; that's future headroom above the floor, not a blocker.
      // Do NOT lower.
      thresholds: {
        statements: 58,
        branches: 37,
        functions: 67,
        lines: 59,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@gustri/queries': resolve(__dirname, '../../packages/queries/src/index.ts'),
      '@gustri/ui-mobile': resolve(__dirname, '../../packages/ui-mobile/src/index.ts'),
      '@sentry/react-native': resolve(__dirname, './src/__tests__/helpers/mock-sentry.ts'),
      '@tanstack/react-query': resolve(__dirname, './node_modules/@tanstack/react-query'),
      '@expo/vector-icons': resolve(
        __dirname,
        './src/__tests__/helpers/mock-expo-vector-icons.tsx',
      ),
      'react-native': resolve(__dirname, './src/__tests__/helpers/mock-react-native.ts'),
      'react-native-paper': resolve(
        __dirname,
        './src/__tests__/helpers/mock-react-native-paper.tsx',
      ),
      'react-native-safe-area-context': resolve(
        __dirname,
        './src/__tests__/helpers/mock-safe-area-context.ts',
      ),
      react: resolve(__dirname, './node_modules/react'),
      'react-dom': resolve(__dirname, './node_modules/react-dom'),
      'react/jsx-runtime': resolve(__dirname, './node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': resolve(__dirname, './node_modules/react/jsx-dev-runtime'),
      // Pin zustand to mobile's copy — the workspace contains a separate
      // `zustand@4.5.7_..._react@18.3.1` variant (resolved for the web apps)
      // whose internal `require('react')` would otherwise load React 18 and
      // trigger a "two copies of React" runtime when ui-mobile's `useNow`
      // hook subscribes from a test mounted against React 19.
      zustand: resolve(__dirname, './node_modules/zustand'),
    },
  },
});
