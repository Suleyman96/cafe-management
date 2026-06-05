/**
 * Guards the package's subpath export surface.
 *
 * `@gustri/database` exposes focused subpaths (`/types`, `/schemas`,
 * `/schemas/inputs`, `/enums`) so consumers don't pull the whole barrel.
 * Each export's `./dist/<X>.mjs` target is produced by tsup from
 * `src/<X>.ts`; if an export points at a path with no matching source, the
 * build emits nothing and consumers get a missing-module error at install
 * time. This test fails fast when an export and its source entry drift —
 * add new subpaths to BOTH package.json `exports` and `tsup.config.ts`.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';

type ExportCondition = { types: string; require: string; import: string };
const exportsMap = pkg.exports as unknown as Record<string, ExportCondition>;
const pkgRoot = fileURLToPath(new URL('../../', import.meta.url));

describe('@gustri/database export surface', () => {
  it('exposes exactly the documented subpaths', () => {
    expect(Object.keys(exportsMap).sort()).toEqual([
      '.',
      './enums',
      './schemas',
      './schemas/inputs',
      './types',
    ]);
  });

  it('each export resolves types/require/import to the same dist basename', () => {
    for (const cond of Object.values(exportsMap)) {
      const base = cond.import.replace('.mjs', '');
      expect(cond.require).toBe(`${base}.js`);
      expect(cond.types).toBe(`${base}.d.ts`);
    }
  });

  it('every export points at a buildable source entry', () => {
    // ./dist/<X>.mjs must be produced from src/<X>.ts
    for (const cond of Object.values(exportsMap)) {
      const entry = cond.import.replace('./dist/', '').replace('.mjs', '');
      expect(existsSync(`${pkgRoot}src/${entry}.ts`), `no src for export ${cond.import}`).toBe(
        true,
      );
    }
  });
});
