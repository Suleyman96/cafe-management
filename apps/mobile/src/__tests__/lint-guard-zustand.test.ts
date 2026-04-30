/**
 * Source-guard test: bans whole-store Zustand subscriptions in mobile app
 * code. Calling `useAuthStore()` (no selector) re-renders the consumer on
 * every unrelated state change. Always pass a selector:
 *   `const staff = useAuthStore((s) => s.staff)`
 *
 * Biome 2.4.9 does not ship `noRestrictedSyntax`, so the guard lives here.
 * Once Biome adds AST-pattern bans, this can be deleted in favor of the
 * lint rule.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const STORE_NAMES = ['useAuthStore', 'usePendingIntentStore', 'useRealtimeStatusStore'];
const VIOLATION_RE = new RegExp(`\\b(${STORE_NAMES.join('|')})\\(\\s*\\)`);

// Resolve mobile/src relative to this test file so the guard works whether
// vitest is invoked from `apps/mobile/` or from the repo root via `pnpm test`.
const mobileSrc = resolve(dirname(__filename), '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('zustand selector guard', () => {
  it('no whole-store useXStore() calls in mobile/src', () => {
    const files = walk(mobileSrc);
    const violations: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (VIOLATION_RE.test(line)) {
          violations.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });
});
