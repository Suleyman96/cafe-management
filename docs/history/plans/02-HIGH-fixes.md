# HIGH Priority Fixes

> Issues that will cause real problems in production or significantly degrade
> developer experience. Should be addressed within the current sprint.
> Estimated effort: 3-5 days total

---

## HIGH-1: CI Missing `@gustri/queries` in Build Filters

### Problem

The CI workflow builds shared packages before running tests and app builds, but
the filter list is incomplete. `@gustri/queries` is never built in CI.

**Affected lines in `.github/workflows/ci.yml`:**
- Line 88 (test job): `pnpm build --filter=@gustri/database --filter=@gustri/core --filter=@gustri/api-client --filter=@gustri/i18n --filter=@gustri/ui`
- Line 117 (build job): same filter list
- Line 152 (e2e job): same filter list

`@gustri/queries` depends on `@gustri/api-client`, `@gustri/core`, and `@gustri/database`.
If any app imports from `@gustri/queries`, it will either:
- Use stale/missing `dist/` output
- Fail to resolve types
- Silently pass if tree-shaking eliminates the import

### Files to Change

- `.github/workflows/ci.yml` (lines 88, 117, 152)

### Fix Plan

**Step 1:** Add `--filter=@gustri/queries` to all three build commands:

```bash
pnpm build --filter=@gustri/database --filter=@gustri/core --filter=@gustri/api-client --filter=@gustri/i18n --filter=@gustri/queries --filter=@gustri/ui
```

**Step 2:** Actually, the better approach is to stop hand-managing this list.
Use Turborepo's dependency graph instead:

```bash
# Builds all packages (not apps) in correct dependency order
pnpm build --filter='./packages/*'
```

This is future-proof — adding a new package won't require CI changes.

**Step 3:** Apply the same pattern to all three locations (test, build, e2e jobs).

### Verification

- CI pipeline passes with the new filter
- `@gustri/queries` dist/ is present during test and build jobs

---

## HIGH-2: CI Doesn't Type-Check Marketing App

### Problem

`.github/workflows/ci.yml:120` only type-checks two apps:
```bash
pnpm type-check --filter=@gustri/staff-web --filter=@gustri/customer-web
```

The marketing app (`apps/marketing/`) is excluded. Type errors in marketing will
never be caught in CI.

### Files to Change

- `.github/workflows/ci.yml` (line 120)

### Fix Plan

**Step 1:** Add marketing to the type-check filter:

```bash
pnpm type-check --filter=@gustri/staff-web --filter=@gustri/customer-web --filter=@gustri/marketing
```

Or better, use a wildcard:

```bash
pnpm type-check --filter='./apps/*'
```

**Note:** Verify that `apps/mobile/package.json` has a `type-check` script.
If it does, the wildcard will include it. If it doesn't, the command will skip it
gracefully (Turborepo skips packages without the target script).

### Verification

- Intentionally add a type error to marketing, verify CI catches it
- Remove the error, verify CI passes

---

## HIGH-3: 4x Redundant CI Install + Build

### Problem

Every CI job (lint, test, build, e2e) independently runs:
1. `pnpm install --frozen-lockfile` (~30-60s)
2. `pnpm build --filter=...packages` (~20-40s)

That's 4x the same work, adding 3-4 minutes to every CI run.

### Files to Change

- `.github/workflows/ci.yml` (restructure jobs)

### Fix Plan

**Step 1:** Add a `setup` job that installs and builds packages, then caches the result:

```yaml
jobs:
  setup:
    name: Install & Build Packages
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build --filter='./packages/*'
      - uses: actions/cache/save@v4
        with:
          path: |
            node_modules
            packages/*/dist
            packages/*/node_modules
            apps/*/node_modules
          key: deps-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-${{ github.sha }}
```

**Step 2:** Update lint, test, build jobs to restore from cache instead of
reinstalling:

```yaml
  lint:
    needs: [setup]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: actions/cache/restore@v4
        with:
          path: |
            node_modules
            packages/*/dist
            packages/*/node_modules
            apps/*/node_modules
          key: deps-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-${{ github.sha }}
      - run: pnpm check
      # ... secret scan
```

**Step 3:** Apply cache/restore to test, build, and e2e jobs similarly.
Remove the duplicate `pnpm install` and `pnpm build --filter=...packages` from each.

### Verification

- CI total time should drop by 2-4 minutes
- All jobs still have access to built packages
- Cache hit rate visible in Actions logs

---

## HIGH-4: Hardcoded Real Email in Test SQL

### Problem

`supabase/create-test-user-direct.sql:8` contains what appears to be a real personal
email address:

```sql
user_email TEXT := 'admin@test.com';
user_password TEXT := 'test123456';
```

This file is committed to the repo. Even though it's for local dev, it:
- Exposes a real email address in version history
- Uses a weak password that might be reused elsewhere
- Could be used for social engineering

### Files to Change

- `supabase/create-test-user-direct.sql`

### Fix Plan

**Step 1:** Replace with a clearly fake test email:

```sql
user_email TEXT := 'admin@test.com';     -- matches existing seed.sql convention
user_password TEXT := 'Test1234!';        -- meets password policy requirements
```

**Step 2:** Update line 81 (the verification query) to match:

```sql
WHERE u.email = 'admin@test.com';
```

**Step 3:** Check if this email appears anywhere else:

```bash
grep -r 'admin@test.com' --include='*.ts' --include='*.sql' --include='*.json' .
```

If found in other files, update those too.

### Verification

- `pnpm db:reset` still works
- The script creates a user and links to staff table
- No real email addresses in the codebase

---

## HIGH-5: Mobile App Has No CI Coverage

### Problem

The mobile app (`apps/mobile/`) is completely excluded from CI:
- No linting
- No type-checking
- No unit tests run
- Only a separate `build-mobile.yml` that builds via EAS (not code quality)

### Files to Change

- `.github/workflows/ci.yml` (add mobile steps)
- Verify `apps/mobile/package.json` has appropriate scripts

### Fix Plan

**Step 1:** Check what scripts mobile has:

The mobile app likely has `type-check`, `lint`, and potentially `test` scripts.
If not, add them to `apps/mobile/package.json`.

**Step 2:** Extend the CI `lint` job to include mobile:

```yaml
      - name: Biome check
        run: pnpm check
```

`pnpm check` at root should already cover mobile if it's in the workspace.
Verify this by checking if `apps/mobile/package.json` has a `lint` script
that Biome runs.

**Step 3:** Add mobile type-checking to the build job:

```yaml
      - name: Type check
        run: pnpm type-check --filter='./apps/*'
```

This will automatically include mobile.

**Step 4:** Add mobile unit tests to the test job (if test files exist in
`apps/mobile/src/__tests__/`):

The root `pnpm test` likely already includes mobile tests since vitest is
configured at root. Verify by checking vitest.config.ts includes patterns.

**Step 5:** Add path filter to avoid running mobile checks when only web
files changed (optimization):

```yaml
  # In the existing lint/test jobs, consider path-based triggers
  # But for simplicity, running all checks on all PRs is fine initially
```

### Verification

- Introduce a type error in `apps/mobile/src/`, verify CI catches it
- Remove the error, verify CI passes
- Mobile test files execute in CI

---

## HIGH-6: 62+ `any` Types in Page Components

### Problem

Staff-web page components use `any` extensively where proper types from
`@gustri/database` should be used. This defeats TypeScript's safety guarantees
and allows runtime type errors.

**Worst offenders (with exact line numbers):**
- `apps/staff-web/src/app/(staff)/orders/page.tsx` — 6 usages (lines 43, 50, 73, 132, 138, 242)
- `apps/staff-web/src/app/(staff)/delivery/page.tsx` — 8 usages (lines 74, 85, 89, 90, 183, 198, 286, 373)
- `apps/staff-web/src/app/(staff)/takeout/page.tsx` — 11 usages (lines 58, 62, 72, 76, 77, 80, 82, 151, 165, 251, 318)
- `apps/staff-web/src/app/(staff)/tables/page.tsx` — 7 usages (lines 36, 39, 41, 81, 91, 97, 171)
- `apps/staff-web/src/lib/i18n.ts` — 5 usages (lines 26-30, all translation namespace types)

**NOTE:** `auth-store.ts` and `use-auth.ts` are already fully typed — no changes needed.
`menu/page.tsx` and `split-payment-modal.tsx` also have no `any` issues.

### Files to Change

All files listed above (7+ files)

### Fix Plan

**Step 1:** Identify the correct types. Most of these should be:
- `OrderWithDetails` (from `@gustri/database` or `@gustri/api-client`)
- `Table` (from `@gustri/database`)
- `Task` (from `@gustri/database`)
- `Staff` (from `@gustri/database`)
- `PlanName` (for tenant plan type)

**Step 2:** For each file, replace `any` with the proper type:

Example for `orders/page.tsx`:
```typescript
// Before
const handleOrderClick = (order: any) => { ... }

// After
import type { OrderWithDetails } from '@gustri/database';
const handleOrderClick = (order: OrderWithDetails) => { ... }
```

**Step 3:** For `i18n.ts`, the `any` types are on dynamic namespace imports.
These can use a proper type:

```typescript
// Before
const namespaces: Record<string, any> = { ... }

// After
import type { Resource } from 'i18next';
const namespaces: Record<string, () => Promise<Resource>> = { ... }
```

**Step 4:** Run `pnpm type-check --filter=@gustri/staff-web` after each file
to ensure the types are correct.

**Step 5:** Run `pnpm test` to verify no runtime behavior changed.

### Approach

Do this file-by-file, not all at once. Each file is a self-contained change.
Prioritize the order:
1. `orders/page.tsx` (most used page, 6 usages)
2. `tables/page.tsx` (7 usages)
3. `takeout/page.tsx` (11 usages — most)
4. `delivery/page.tsx` (8 usages)
5. `i18n.ts` (5 usages — namespace types)

### Verification

- `pnpm type-check` passes with no errors
- `pnpm test` passes
- No runtime regressions in dev mode

---

## Execution Order

1. **HIGH-1 + HIGH-2** (CI filters) — 15 min, immediate CI improvement
2. **HIGH-3** (CI caching) — 1 hour, significant CI speedup
3. **HIGH-4** (hardcoded email) — 5 min, security hygiene
4. **HIGH-5** (mobile CI) — 30 min, coverage gap
5. **HIGH-6** (any types) — 2-3 hours, code quality

## Definition of Done

- [ ] CI builds all packages including `@gustri/queries`
- [ ] CI type-checks all apps including marketing
- [ ] CI install+build happens once, cached across jobs
- [ ] No real email addresses in test fixtures
- [ ] Mobile app has lint + type-check + test in CI
- [ ] Zero `any` types in staff-web page components
- [ ] All tests pass, all builds succeed
