import { defineConfig } from 'tsup';

export default defineConfig({
  // Multiple entry points so consumers can import the focused subpath
  // (`@gustri/database/types`, `/schemas`, `/schemas/inputs`, `/enums`)
  // instead of pulling the whole barrel. Object form pins deterministic
  // output paths (dist/<key>.{js,mjs,d.ts}) that package.json `exports`
  // maps to.
  entry: {
    index: 'src/index.ts',
    'types/index': 'src/types/index.ts',
    'enums/index': 'src/enums/index.ts',
    'schemas/index': 'src/schemas/index.ts',
    'schemas/inputs': 'src/schemas/inputs.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  // Shared modules (enum-schemas, generated types) dedupe into chunks for
  // esm rather than being copied into every entry.
  splitting: true,
  external: ['react', 'react-dom', '@supabase/supabase-js'],
});
