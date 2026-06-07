import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import enAuth from '../locales/en/auth.json';
import enCommon from '../locales/en/common.json';
import enCustomer from '../locales/en/customer.json';
import enErrors from '../locales/en/errors.json';
import enNav from '../locales/en/nav.json';
import enRoles from '../locales/en/roles.json';
import enStaff from '../locales/en/staff.json';

// Automated proxy for MOBILE_PARITY_PLAN.md Phase 5.2 ("Cross-device shift
// test — waiter starts on web, switches to mobile mid-shift, note hesitations
// / terminology surprises"). We can't put a real waiter on the floor, but we
// can lock the i18n contract so a terminology drift between the two apps
// shows up in CI.
//
// Two guarantees:
//   1. Every static `t('foo.bar')` call in either app resolves to a real key
//      in some EN namespace (catches typos and removed keys).
//   2. The set of i18n keys used by BOTH apps is snapshot-tested. PRs that
//      introduce a label only on one platform — or change one side's key
//      while leaving the other on the old key — surface as a snapshot diff
//      that a reviewer can examine for intentional vs accidental drift.

const HERE =
  typeof __dirname !== 'undefined' ? __dirname : fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const STAFF_WEB_SRC = join(REPO_ROOT, 'apps', 'staff-web', 'src');
const MOBILE_SRC = join(REPO_ROOT, 'apps', 'mobile', 'src');

const NAMESPACES = {
  common: enCommon as Record<string, string>,
  nav: enNav as Record<string, string>,
  auth: enAuth as Record<string, string>,
  staff: enStaff as Record<string, string>,
  customer: enCustomer as Record<string, string>,
  roles: enRoles as Record<string, string>,
  errors: enErrors as Record<string, string>,
};

const ALL_KEYS = new Set<string>();
for (const ns of Object.values(NAMESPACES)) {
  for (const k of Object.keys(ns)) ALL_KEYS.add(k);
}

const SOURCE_FILE_RE = /\.(ts|tsx|js|jsx)$/;
const SKIP_PATH_RE =
  /(node_modules|__tests__|__mocks__|\/e2e\/|\/maestro\/|\.test\.[jt]sx?$|\.spec\.[jt]sx?$|\.d\.ts$)/;

// Matches `t('foo.bar')` and `i18n.t('foo.bar')` (the `.` before `t` is a
// non-identifier char, so the negative lookbehind still allows it). Skips
// identifiers like `format(`, `connect(`, `setT(` etc.
const T_CALL_RE = /(?<![\w$])t\(\s*['"]([^'"`]+)['"]/g;

// Dynamic template-literal keys like t(`foo.${x}`) — counted but not validated,
// since the actual key isn't statically known.
const T_DYNAMIC_RE = /(?<![\w$])t\(\s*`[^`]*\$\{/g;

// A handful of keys are constructed dynamically at runtime via prefix +
// runtime value. The static prefix shows up as a literal string passed to a
// helper, not as a t() call — those won't trip the scanner. Allowlist for
// false positives the scanner picks up that aren't real i18n keys (e.g.
// keys passed through `defaultValue` in helpers, debug labels). Keep this
// list short; prefer fixing the call site.
const ALLOWLIST = new Set<string>([]);

interface Extraction {
  staticKeys: Set<string>;
  dynamicHits: number;
  callSites: Map<string, string[]>;
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    if (SKIP_PATH_RE.test(full)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (SOURCE_FILE_RE.test(name)) out.push(full);
  }
  return out;
}

function extract(root: string): Extraction {
  const staticKeys = new Set<string>();
  const callSites = new Map<string, string[]>();
  let dynamicHits = 0;
  for (const file of walk(root)) {
    const content = readFileSync(file, 'utf8');
    const rel = relative(REPO_ROOT, file);
    for (const m of content.matchAll(T_CALL_RE)) {
      const key = m[1];
      // The regex's first capture group always matches when the overall
      // pattern matches; guard for the type checker (noUncheckedIndexedAccess).
      if (key === undefined) continue;
      if (ALLOWLIST.has(key)) continue;
      staticKeys.add(key);
      const list = callSites.get(key) ?? [];
      if (!list.includes(rel)) list.push(rel);
      callSites.set(key, list);
    }
    for (const _ of content.matchAll(T_DYNAMIC_RE)) dynamicHits++;
  }
  return { staticKeys, callSites, dynamicHits };
}

function hasAnyVariant(present: (k: string) => boolean, base: string): boolean {
  // i18next plural lookup: `t('foo', { count })` resolves via `foo_one` /
  // `foo_other` and only falls back to the bare `foo`. Per CLAUDE.md the
  // codebase only uses `_one`/`_other` (no `_few`/`_many`), so a key counts
  // as resolved if the bare or either suffix exists.
  return present(base) || present(`${base}_one`) || present(`${base}_other`);
}

function resolves(key: string): boolean {
  // i18next ns-prefixed form: `common:error.title` → look up `error.title`
  // inside the `common` namespace.
  const colon = key.indexOf(':');
  if (colon !== -1) {
    const nsName = key.slice(0, colon) as keyof typeof NAMESPACES;
    const rest = key.slice(colon + 1);
    const ns = NAMESPACES[nsName];
    if (!ns) return false;
    return hasAnyVariant((k) => k in ns, rest);
  }
  return hasAnyVariant((k) => ALL_KEYS.has(k), key);
}

const WEB = extract(STAFF_WEB_SRC);
const MOBILE = extract(MOBILE_SRC);

const sharedKeys = [...WEB.staticKeys].filter((k) => MOBILE.staticKeys.has(k)).sort();

describe('Phase 5.2 — cross-platform i18n parity', () => {
  it('scanner found a non-trivial number of t() call sites in each app', () => {
    // Sanity check: if either of these is suspiciously low, the regex is
    // probably broken (or the test is being run against an empty checkout).
    expect(WEB.staticKeys.size).toBeGreaterThan(100);
    expect(MOBILE.staticKeys.size).toBeGreaterThan(100);
  });

  it('every static t() key used by staff-web resolves to an EN translation', () => {
    const missing = [...WEB.staticKeys]
      .filter((k) => !resolves(k))
      .map((k) => ({ key: k, files: WEB.callSites.get(k) ?? [] }));
    expect(missing).toEqual([]);
  });

  it('every static t() key used by mobile resolves to an EN translation', () => {
    const missing = [...MOBILE.staticKeys]
      .filter((k) => !resolves(k))
      .map((k) => ({ key: k, files: MOBILE.callSites.get(k) ?? [] }));
    expect(missing).toEqual([]);
  });

  it('the shared cross-platform vocabulary matches the committed snapshot', () => {
    // This is the cross-device terminology contract. A reviewer should look
    // at any diff and ask: "did one platform start using a new key for an
    // action the other platform still uses an older key for?" If yes, the
    // out-of-sync platform should be updated in the same PR.
    expect(sharedKeys).toMatchSnapshot();
  });
});

// ─── Regression guard for {value} + {t(...)} concatenation ────────────
// JSX `{value} {t('foo')}` (and the `${value} ${t('foo')}` /
// `${t('foo')} ${value}` template-literal variants) hard-code English
// word order: the value lands adjacent to the translated phrase in a
// fixed position. Locales that put the value elsewhere (Turkish: "bu
// masada 2 sipariş var") render broken. The fix is always the same
// shape — embed {{value}} inside the i18n key and pass it via
// `t(key, { value })`. This guard fails when a new concat site is added.
//
// What we DO NOT flag:
//   - `{t('foo')} {value}` in JSX. Too many false positives from button
//     layouts like `<Icon /> {t('label')}` where the LHS is a sibling
//     JSX element, not a value-render. Reverse-direction translation+
//     value bugs are still caught by the template-literal regex below
//     and are rare in JSX (the natural way to render them is via
//     interpolation already).
//
// ALLOWLIST is for translations that render correctly across locales as
// a value-adjacent postfix (units like "min", "kg"; universal
// abbreviations). Keep it short and defend each entry.

const CONCAT_ALLOWLIST = new Set<string>([
  // Units — postfix in essentially every locale ("5 min", "5 kg").
  'kitchen.min',
  'payment.each',
  // Universal abbreviations / postfix labels with stable word order.
  'orders.tip',
  'orders.netPrice',
  'orders.inclDelivery',
  // tables.seats: in many locales the count+seats form is invariant
  // (TR "6 kişilik"); leave as-is until a real locale breakage is reported.
  'tables.seats',
  'each',
  // UNIT_KEYS dynamic lookup — `t(UNIT_KEYS[item.unit] || item.unit)`.
  // Stock units (kg, l, etc.) are universal postfix. The scanner can't
  // see the dynamic key directly; this guards the lookup pattern.
  'UNIT_KEYS',
]);

// `{expr} {t('foo')}` — value-render expression followed by translation.
// Limited to single-line expressions without nested braces, which covers
// the bug shape we refactored away. We additionally skip when the leading
// expression starts with `<` (a JSX element like `<Icon />` rendered
// inline) — those are siblings, not value concatenation.
const CONCAT_BEFORE = /\{([^{}\n]+)\}\s+\{t\(\s*['"]([^'"`]+)['"]/g;

// `${t('foo')} ${expr}` and `${expr} ${t('foo')}` — template literals.
// Template literals are unambiguously string concatenation, so both
// directions are real bugs.
const TPL_AROUND =
  /\$\{[^{}\n]+\}\s*\$\{t\(\s*['"]([^'"`]+)['"]|\$\{t\(\s*['"]([^'"`]+)['"][^}]*\)\}\s*\$\{[^{}\n]+\}/g;

function findConcatSmells(roots: string[]): Array<{ file: string; key: string }> {
  const hits: Array<{ file: string; key: string }> = [];
  for (const root of roots) {
    for (const file of walk(root)) {
      const content = readFileSync(file, 'utf8');
      const rel = relative(REPO_ROOT, file);
      for (const m of content.matchAll(CONCAT_BEFORE)) {
        // Both capture groups are non-optional in CONCAT_BEFORE, so they're
        // defined whenever the pattern matches; guard for the type checker.
        if (m[1] === undefined || m[2] === undefined) continue;
        const lhs = m[1].trim();
        // Skip JSX element renders: `<Icon />`, `<Spinner />`, ternaries
        // that contain a JSX element.
        if (lhs.startsWith('<') || /<[A-Z]/.test(lhs)) continue;
        // Skip when the LHS is itself a translation call: `{t('a')} {t('b')}`.
        if (lhs.startsWith('t(') || lhs.startsWith('tCommon(')) continue;
        // Skip when the LHS is a literal string (whitespace, bullet, etc.
        // used as a JSX separator between two translations).
        if (/^['"`]/.test(lhs)) continue;
        // Skip when the LHS is a React-element accessor (`badge.icon`,
        // `cfg.Icon`, `item.iconName`). These render an element, not text.
        if (/\.(icon|Icon|iconName)$/.test(lhs)) continue;
        const key = m[2];
        if (CONCAT_ALLOWLIST.has(key)) continue;
        hits.push({ file: rel, key });
      }
      for (const m of content.matchAll(TPL_AROUND)) {
        const key = m[1] ?? m[2];
        if (key && !CONCAT_ALLOWLIST.has(key)) hits.push({ file: rel, key });
      }
    }
  }
  return hits;
}

describe('Phase 5.2 regression guard — no {value} + {t(...)} concatenation', () => {
  it('staff-web source contains no concat smells outside the allowlist', () => {
    expect(findConcatSmells([STAFF_WEB_SRC])).toEqual([]);
  });

  it('mobile source contains no concat smells outside the allowlist', () => {
    expect(findConcatSmells([MOBILE_SRC])).toEqual([]);
  });
});
