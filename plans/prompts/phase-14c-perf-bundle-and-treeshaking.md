# Phase 14C: Performance — Bundle Size and Tree-Shaking

## Goal

Fix package-level issues that prevent tree-shaking and inflate bundle size:
1. All 4 packages are missing `"sideEffects": false` in `package.json`
2. `packages/ui/src/index.ts` has `'use client'` at the barrel level — any server component importing from `@gustri/ui` silently opts into client rendering
3. Sidebar calls 6 data-fetching hooks on every render (informational — document but don't refactor)

## Important

- Read each file before editing
- Run `pnpm build` after changes to verify no build errors
- Run `pnpm type-check && pnpm test` after changes
- These changes affect how bundlers process the packages — test the built output

---

## Step 1: Add `"sideEffects": false` to All Package `package.json` Files

This tells bundlers (webpack, esbuild, Rollup) that unused exports can be safely tree-shaken. Without it, the entire package is included even if only one export is used.

### 1a: `packages/database/package.json`

Read the file. Add at the top level (alongside `"name"`, `"version"`, etc.):
```json
"sideEffects": false,
```

This is safe because `packages/database/` only exports types, Zod schemas, and enum constants — no module-level side effects (no global state mutations, no DOM manipulation, no polyfills).

### 1b: `packages/core/package.json`

Read the file. Add:
```json
"sideEffects": false,
```

Safe because `packages/core/` exports pure functions and constants. No module-level side effects.

### 1c: `packages/api-client/package.json`

Read the file. Add:
```json
"sideEffects": false,
```

Safe because the wrapper factory functions are pure — they create objects but don't execute side effects at import time.

### 1d: `packages/ui/package.json`

Read the file. Add:
```json
"sideEffects": false,
```

This is safe AFTER Step 2 (removing `'use client'` from the barrel). Individual component files will carry their own `'use client'` directives.

---

## Step 2: Move `'use client'` from UI Barrel to Individual Components

**File:** `packages/ui/src/index.ts`

Read the file. Find line 1:
```typescript
'use client';
```

This marks the **entire barrel export** as a client boundary. Any Next.js server component that imports anything from `@gustri/ui` — even a pure utility like `cn()` — is forced into the client bundle.

### Fix:

Remove `'use client'` from `packages/ui/src/index.ts`.

Then add `'use client'` to each individual component file that uses React hooks or browser APIs:

Read each component file to determine if it needs `'use client'`:

- `packages/ui/src/button.tsx` — Does it use `useState`, `useEffect`, `onClick` handlers, or other client-only APIs? If yes, add `'use client';` at line 1.
- `packages/ui/src/loading-spinner.tsx` — Same check.
- `packages/ui/src/badge.tsx` — Same check.
- `packages/ui/src/number-input.tsx` — Likely uses `onChange` handler → needs `'use client'`.
- `packages/ui/src/gustri-logo.tsx` — Pure SVG component? If no hooks/handlers, doesn't need it.

For each file:
1. Read it
2. Check if it uses hooks (`useState`, `useEffect`, `useRef`, etc.) or event handlers (`onClick`, `onChange`)
3. If yes → add `'use client';` at line 1
4. If no (pure render, no interactivity) → don't add it

Also check if there's a `cn()` utility exported from the barrel. If `cn()` is a pure function (just `clsx` + `twMerge`), it should NOT have `'use client'` and can be safely imported from server components after this fix.

---

## Step 3: Verify Tree-Shaking Works

After Steps 1-2, verify the build output:

```bash
pnpm build
```

Check that the build completes without errors. If any app has a server component importing from `@gustri/ui`, the build would have previously worked (because the barrel had `'use client'`). After removing it from the barrel, if a server component imports a component that now has its own `'use client'`, it will still work — Next.js handles the boundary at the component level.

If a server component imports a component that does NOT have `'use client'` but uses hooks, the build will error. This is correct behavior — it surfaces a real issue that was previously masked.

---

## Step 4: Document Sidebar Hook Load (No Code Change)

The staff-web sidebar calls 6 data-fetching hooks on every render:
- `useOverdueTasksCount()` — tasks query
- `usePendingApprovalCount()` — orders query (filtered by status)
- `useCafeSettings()` — settings query
- `useTenantPlan()` — tenant query
- `useMyTasks(staffId)` — tasks query (potentially overlapping with #1)
- `useMyScheduleToday(staffId)` — schedules query

All use React Query with stale times (~60s), so they don't refetch on every render — they just subscribe to the cache. The hook calls themselves are lightweight. This is acceptable for now but worth noting:

- `useOverdueTasksCount()` and `useMyTasks()` both query tasks — they could share a single query with client-side derivation
- `usePendingApprovalCount()` runs a full orders query just for a count — a dedicated count endpoint or a lighter query would be more efficient

**No code change needed** — just awareness for future optimization.

---

## Final Verification

```bash
pnpm build         # Full build — critical for tree-shaking verification
pnpm type-check    # TypeScript check
pnpm test          # All tests
pnpm check         # Biome
```

Check for any server component errors after removing `'use client'` from the UI barrel:
```bash
grep -rn "from '@gustri/ui'" apps/staff-web/src/app/ apps/customer-web/src/app/ --include="*.tsx" | head -20
```

If any matches are in server components (files without `'use client'`), verify the imported component has its own `'use client'` directive.

## Commit

Commit with message: `perf: enable tree-shaking with sideEffects flag, move use-client to individual UI components`
