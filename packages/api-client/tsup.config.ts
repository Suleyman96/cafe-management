import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false, // Skip declaration generation due to Supabase type issues (never return types)
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom', '@supabase/supabase-js'],
});
