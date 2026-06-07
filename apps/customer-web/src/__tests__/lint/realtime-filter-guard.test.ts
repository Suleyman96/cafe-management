/**
 * Lint guard: customer-web realtime filters must be UUID-keyed or
 * tenant-scoped.
 *
 * Background. Customer-web subscribes to Supabase Realtime
 * `postgres_changes` events with anon-JWT credentials. Realtime broadcasts
 * are gated by the `postgres_changes` filter only — `eventsPerSecond` is
 * shared across the channel, and the filter syntax accepts ONE column
 * predicate per `.on()` call (no `AND`). Today every customer-web filter
 * keys on a UUID column (`id`, `order_id`, `table_id`), and UUIDs are
 * globally unique, so a bad actor on tenant A cannot guess a UUID
 * belonging to tenant B and silently subscribe to its events.
 *
 * The risk this guard prevents. A future change that filters on a
 * non-unique column (`status`, `priority`, `order_type`, etc.) without
 * adding `tenant_id=eq.` would re-introduce a presence-leak surface:
 * tenant B's events would broadcast to tenant A's anon clients on the
 * shared channel, and only RLS at the row-fetch layer would prevent the
 * leak — but `postgres_changes` payloads include the row, so RLS-on-fetch
 * is too late. The defense must live at the broadcast filter.
 *
 * What this guard enforces. Every filter literal passed to
 * `.on('postgres_changes', ...)` in `apps/customer-web/src/hooks/` must
 * contain either:
 *   - `id=eq.` — keys on a UUID column (covers `id`, `order_id`,
 *     `table_id`, and any future `*_id` foreign key, which are all
 *     UUIDs in this schema), OR
 *   - `tenant_id=eq.` — broadcast-layer tenant scope (broader event
 *     volume, but explicitly tenant-bound).
 *
 * Anti-goal (per audit prompt #9). Do NOT silently widen filters to
 * `tenant_id=eq.` — on a busy tenant that exceeds the
 * `eventsPerSecond: 10` realtime budget configured in
 * `apps/customer-web/src/lib/supabase.ts` and starts dropping legitimate
 * events. Stay UUID-keyed unless the product team requires real
 * isolation guarantees, in which case migrate to private channels (see
 * the plan in `plans/realtime-cache-audit-remaining-prompts.md` #9
 * option 3).
 *
 * Authoring escape hatch. None. If a future filter genuinely needs to be
 * non-UUID and non-tenant-scoped, that's a redesign, not a bypass — the
 * concrete use case should land alongside an updated note in
 * `apps/customer-web/README.md` and a refreshed version of this guard.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const HOOKS_DIR = resolve(__dirname, '../../hooks');

function listHookFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listHookFiles(full));
    } else if (extname(entry) === '.ts' || extname(entry) === '.tsx') {
      out.push(full);
    }
  }
  return out;
}

// Match the filter literal that follows the closest preceding
// 'postgres_changes' marker. The literal can be a template (`...`),
// single-, or double-quoted string. Lazy `[\s\S]*?` keeps the match
// scoped to the nearest filter property, not a downstream one.
const FILTER_RE = /['"]postgres_changes['"][\s\S]*?filter:\s*([`'"])((?:\\.|(?!\1)[\s\S])*?)\1/g;

function extractFilters(source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(FILTER_RE)) {
    // Group 2 (the filter literal) is a required capture; on a successful
    // match it is always present (may be empty, never undefined).
    out.push(match[2]!);
  }
  return out;
}

function isAllowedFilter(filter: string): boolean {
  return filter.includes('id=eq.') || filter.includes('tenant_id=eq.');
}

describe('customer-web realtime filter guard', () => {
  it('every postgres_changes filter is UUID-keyed or tenant-scoped', () => {
    const files = listHookFiles(HOOKS_DIR);
    const violations: Array<{ file: string; filter: string }> = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const filter of extractFilters(source)) {
        if (!isAllowedFilter(filter)) {
          violations.push({ file, filter });
        }
      }
    }

    expect(
      violations,
      `Realtime filters in customer-web must include 'id=eq.' or 'tenant_id=eq.'.\n` +
        `See apps/customer-web/src/__tests__/lint/realtime-filter-guard.test.ts for rationale.\n` +
        `Violations: ${JSON.stringify(violations, null, 2)}`,
    ).toEqual([]);
  });

  it('detects non-UUID, non-tenant-scoped filters (self-test)', () => {
    // Sanity-check the regex + predicate against synthesized source — proves
    // the guard would actually fire on a regression. If this test breaks,
    // the FILTER_RE regex needs refresh; the production assertion above
    // would silently pass against an empty extraction.
    const goodSource = `
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: \`id=eq.\${orderId}\` },
        () => {},
      )
    `;
    const badSource = `
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: \`status=eq.new\` },
        () => {},
      )
    `;

    expect(extractFilters(goodSource).every(isAllowedFilter)).toBe(true);
    expect(extractFilters(badSource).every(isAllowedFilter)).toBe(false);
  });
});
