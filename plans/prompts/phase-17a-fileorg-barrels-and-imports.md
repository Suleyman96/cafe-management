# Phase 17A: File Organization — Fix Barrel Exports, Import Path Consistency, and Misplaced Files

## Goal

Fix structural file organization issues:
1. 4 staff-web hooks missing from barrel export
2. customer-web has no hooks barrel at all
3. 2 mobile hooks missing from barrel export
4. `MenuItemWithCategory` imported from 3 different paths in customer-web — unify
5. `delivery-menu-content.tsx` is a client component in an `app/` route directory instead of `src/components/`
6. `settings-types.ts` is a types file in a `components/` directory
7. staff-web `types/index.ts` re-exports runtime constants from a `types/` file

## Important

- Read each file before editing
- Run `pnpm type-check` after each step
- Import path changes are high-volume but low-risk — TypeScript catches any broken imports
- Do NOT change any logic — only move files and update imports

---

## Step 1: Add Missing Hooks to Staff-Web Barrel

**File:** `apps/staff-web/src/hooks/index.ts`

Read the file. Add the 4 missing exports:

```typescript
export * from './use-format-price';
export * from './use-order-filters';
export * from './use-realtime-sync';
export * from './use-staff-cart';
```

After adding, the 22 files that currently import `useFormatPrice` via the direct path `@/hooks/use-format-price` will continue to work (direct imports aren't broken by barrel additions). But new code can use `@/hooks` consistently.

Optionally, update existing callers to import from the barrel instead of the direct path. This is a large mechanical change (22 files for `use-format-price` alone) — do it only if the team prefers barrel-only imports.

---

## Step 2: Create Customer-Web Hooks Barrel

**File:** Create `apps/customer-web/src/hooks/index.ts`

Read the hooks directory listing. Create a barrel that exports all hooks:

```typescript
export * from './use-cart-item-notes';
export * from './use-delivery';
export * from './use-format-price';
export * from './use-menu';
export * from './use-order';
export * from './use-place-order';
export * from './use-settings';
export * from './use-table';
export * from './use-tax-multiplier';
export * from './use-waiter-call';
```

Read each hook file to verify what it exports before adding to the barrel. Some may have conflicting export names.

This is non-breaking — existing direct-path imports continue to work. New code can optionally import from `@/hooks`.

---

## Step 3: Add Missing Hooks to Mobile Barrel

**File:** `apps/mobile/src/hooks/index.ts`

Read the file. Add the 2 missing exports:

```typescript
export * from './use-network-status';
export * from './use-snackbar';
```

---

## Step 4: Unify `MenuItemWithCategory` Import Path in Customer-Web

Currently imported from 3 paths:
- `'@gustri/database'` (3 files)
- `'@/types'` (3 files — importing a local duplicate)
- Inline `import('@gustri/database')` was already fixed in earlier phases

### 4a: Remove local duplicate from `types/index.ts`

**File:** `apps/customer-web/src/types/index.ts`

Read the file. Find the local `MenuItemWithCategory` definition (~lines 13-15):
```typescript
export interface MenuItemWithCategory extends MenuItem {
  category: Category | null;
}
```

Compare with `packages/database/src/types/index.ts` — the shared type should be identical or compatible. If it is, remove the local definition and add a re-export:

```typescript
export type { MenuItemWithCategory } from '@gustri/database';
```

Or simply remove it — callers importing from `@/types` will get it via the `export * from '@gustri/database'` if that exists in the file.

Read the file to check if it does `export * from '@gustri/database'`. If not, add the explicit re-export.

### 4b: Standardize import path

After removing the duplicate, all 6 files should import `MenuItemWithCategory` from the same source. The convention in this project is to use `@/types` for type imports in app code (which re-exports from `@gustri/database`). No changes needed to the 3 files already using `@/types`. Update the 3 files using `'@gustri/database'` directly:

Files to update:
1. `apps/customer-web/src/app/delivery/menu/delivery-menu-content.tsx`
2. `apps/customer-web/src/components/menu/menu-screen.tsx`
3. `apps/customer-web/src/hooks/use-menu.ts`

Change from:
```typescript
import type { MenuItemWithCategory } from '@gustri/database';
```
To:
```typescript
import type { MenuItemWithCategory } from '@/types';
```

Or, if the team prefers `@gustri/database` as the canonical path, update the 3 `@/types` callers instead. Pick one path and be consistent. The `@/types` path is more conventional in this codebase since it provides a single app-level import layer.

---

## Step 5: Move `delivery-menu-content.tsx` to Components Directory

**File:** `apps/customer-web/src/app/delivery/menu/delivery-menu-content.tsx`

This is the only non-framework-slot `'use client'` component living inside an `app/` route directory. Move it to follow the convention.

### Move:
```
FROM: apps/customer-web/src/app/delivery/menu/delivery-menu-content.tsx
TO:   apps/customer-web/src/components/menu/delivery-menu-content.tsx
```

### Update the importer:

**File:** `apps/customer-web/src/app/delivery/menu/page.tsx`

Change:
```typescript
import { DeliveryMenuContent } from './delivery-menu-content';
```
To:
```typescript
import { DeliveryMenuContent } from '@/components/menu/delivery-menu-content';
```

---

## Step 6: Move `settings-types.ts` to Types Directory

**File:** `apps/staff-web/src/components/settings/settings-types.ts`

This is a type-only `.ts` file in a components directory. Move it:

```
FROM: apps/staff-web/src/components/settings/settings-types.ts
TO:   apps/staff-web/src/types/settings.ts
```

Search for all imports of this file:
```bash
grep -rn "settings-types" apps/staff-web/src/ --include="*.ts" --include="*.tsx"
```

Update each import path from `@/components/settings/settings-types` to `@/types/settings`.

Expected callers: the settings tab components in `apps/staff-web/src/components/settings/` (branding-settings-tab, contact-settings-tab, general-settings-tab).

---

## Step 7: Clean Up Staff-Web `types/index.ts` Runtime Re-Exports

**File:** `apps/staff-web/src/types/index.ts`

Read the file. It re-exports runtime constants from `@gustri/core` alongside type re-exports:

```typescript
export { ORDER_STATUS, TABLE_STATUS, USER_ROLE, ... } from '@gustri/core';
```

These are runtime objects, not types. A file in `types/` re-exporting runtime values is misleading.

### Fix options:

**Option A (recommended):** Move runtime constant re-exports to a separate file:

Create `apps/staff-web/src/lib/constants.ts`:
```typescript
export { ORDER_ITEM_STATUS, ORDER_STATUS, QUERY_KEYS, REFRESH_INTERVALS, STATUS_COLORS, TABLE_STATUS, USER_ROLE, WAITER_CALL_STATUS } from '@gustri/core';
```

Remove these exports from `types/index.ts`. Update all callers:
```bash
grep -rn "from '@/types'" apps/staff-web/src/ --include="*.ts" --include="*.tsx" | grep -E "ORDER_STATUS|TABLE_STATUS|USER_ROLE|QUERY_KEYS|REFRESH_INTERVALS|STATUS_COLORS|WAITER_CALL_STATUS|ORDER_ITEM_STATUS"
```

Change their imports from `@/types` to `@/lib/constants`.

**Option B (simpler):** Add a comment to `types/index.ts` explaining the mixed re-exports and leave as-is. This is less clean but avoids updating many import paths.

Choose Option A if fewer than ~10 files need updating. Choose Option B if it's widespread.

---

## Final Verification

```bash
pnpm type-check   # Catches all broken imports
pnpm test          # All tests pass
pnpm check         # Biome
```

## Commit

Commit with message: `refactor: fix barrel exports, unify import paths, move misplaced files`
