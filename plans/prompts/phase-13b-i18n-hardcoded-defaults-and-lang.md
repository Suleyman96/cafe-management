# Phase 13B: Hardcoded Strings — Fix Currency Defaults, Tax Fallback, `lang` Attribute, and Staff-Web Labels

## Goal

Fix hardcoded locale-specific defaults (`'¥'`, `'JPY'`, `'ja'`, `?? 18`) that flash wrong values for non-Japanese deployments, the hardcoded `<html lang="ja">` attribute, and untranslated staff-web utility labels.

## Important

- Read each file before editing
- Run `pnpm type-check && pnpm test` after changes
- The default currency/language must be neutral or loaded from settings — not hardcoded to any specific locale

---

## Step 1: Fix Hardcoded `<html lang="ja">` in Both Web Apps

### 1a: Customer-Web

**File:** `apps/customer-web/src/app/layout.tsx`

Find line 30:
```tsx
<html lang="ja">
```

The `lang` attribute should reflect the user's selected language, not be hardcoded to Japanese.

Read how the language store works in customer-web. Check `apps/customer-web/src/store/language-store.ts` for a persisted language value.

Since `layout.tsx` is a server component and can't use client hooks, the options are:

**Option A (simplest):** Use a neutral default and let a client component update it:
```tsx
<html lang="en" suppressHydrationWarning>
```

Then create (or check if it exists) a small client component `HtmlLangSetter` that reads the language from the store/cookie and updates `document.documentElement.lang`:

```typescript
'use client';
import { useEffect } from 'react';
import { useLanguageStore } from '@/store/language-store';

export function HtmlLangSetter() {
  const language = useLanguageStore((s) => s.language);
  useEffect(() => {
    document.documentElement.lang = language || 'en';
  }, [language]);
  return null;
}
```

Add `<HtmlLangSetter />` inside the `<body>` of the layout.

Check if a similar component already exists — search for `documentElement.lang` in customer-web.

### 1b: Staff-Web

**File:** `apps/staff-web/src/app/layout.tsx`

Same fix — find `<html lang="ja">` at line 30. Apply the same pattern.

Read how staff-web manages language (it has an auth store with `preferred_language`). The `HtmlLangSetter` component should read from the appropriate store.

---

## Step 2: Fix Hardcoded Currency Defaults

The pattern `currency_symbol: '¥'`, `currency_code: 'JPY'` appears as placeholder/default data that shows before real settings load. Users on non-Japanese deployments see `¥` pricing briefly.

### 2a: Staff-Web Cafe Settings Page

**File:** `apps/staff-web/src/app/(staff)/cafe-settings/page.tsx`

Find the initial `formData` state (~lines 22-57). It has:
```typescript
currency_symbol: '¥',
currency_code: 'JPY',
default_language: 'ja',
```

Replace with empty/neutral defaults that won't be displayed (the form should show a loading state until real settings load):

```typescript
currency_symbol: '',
currency_code: '',
default_language: '',
```

Read the component to verify:
- Is there a loading state before settings arrive? If not, add one.
- The `useEffect` that populates `formData` from fetched settings — verify it runs before the form is rendered.

If the form renders immediately with defaults, the user would see empty fields briefly. Better approach: keep the defaults but add a loading check:

```typescript
if (settingsLoading) return <LoadingSpinner />;
```

Find if `settingsLoading` or `isLoading` is already available from the settings hook.

Also fix `settings.default_language ?? 'ja'` at lines 99 and 175. Replace `'ja'` with `'en'` (more neutral default) or get it from an env variable:

```typescript
settings.default_language ?? (process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE || 'en')
```

### 2b: Customer-Web Settings Hook

**File:** `apps/customer-web/src/hooks/use-settings.ts`

Find `DEFAULT_SETTINGS` (~lines 17-40):
```typescript
currency_symbol: '¥',
currency_code: 'JPY',
default_language: 'ja',
```

These defaults are used as `placeholderData` in React Query — they show while the real settings are loading.

Replace with neutral defaults:
```typescript
currency_symbol: '$',
currency_code: 'USD',
default_language: 'en',
```

Or better — don't show pricing at all until settings load. Read how `DEFAULT_SETTINGS` is consumed:
- If it's used as `placeholderData` in `useQuery`, the loading state still shows `isLoading: true` first. The placeholders only appear if accessed while loading.
- If it's used as a fallback in components, changing it to neutral values is sufficient.

### 2c: Customer-Web `formatPrice` Default Currency

**File:** `apps/customer-web/src/lib/utils.ts`

Find line 11:
```typescript
export function formatPrice(amount: number, currency: string = '€'): string {
```

This function uses `'€'` as default but is never imported in production code (confirmed dead in our review). If it's dead code, remove it. If it's used somewhere, change the default to `'$'`:

```typescript
export function formatPrice(amount: number, currency: string = '$'): string {
```

### 2d: Mobile Settings Component Fallbacks

**File:** `apps/mobile/src/components/cafe-settings/DeliverySection.tsx`

Find lines 30 and 41:
```typescript
form.currency_symbol || '¥'
```

Replace with `'$'` or use the `useCurrencySymbol()` hook if Phase 9C was completed:
```typescript
form.currency_symbol || '$'
```

**File:** `apps/mobile/src/components/cafe-settings/OrderSettingsSection.tsx`

Find line 22:
```typescript
form.currency_symbol || '¥'
```

Same fix — replace `'¥'` with `'$'`.

---

## Step 3: Fix Hardcoded Tax Fallback `?? 18`

The tax percentage default `18` (Japan consumption tax) appears in 5 files. Replace with `0` (no tax shown until settings load) or a configurable constant.

### Create a constant

**File:** `packages/core/src/constants.ts`

Read the file. Add:
```typescript
/** Default tax percentage used when cafe settings haven't loaded yet */
export const DEFAULT_TAX_PERCENTAGE = 0;
```

Using `0` means no tax is shown until real settings load — this is safer than guessing a country-specific rate.

### Replace all `?? 18` occurrences

Search for `tax_percentage ?? 18` and `tax_percentage || 18` across the codebase and replace with `DEFAULT_TAX_PERCENTAGE`:

1. **`apps/staff-web/src/components/orders/create-takeout-modal.tsx`** — line 347
2. **`apps/staff-web/src/components/tables/table-cart.tsx`** — line 127
3. **`apps/staff-web/src/app/(staff)/orders/[id]/add-items/page.tsx`** — line 272
4. **`apps/staff-web/src/components/modals/create-delivery-modal.tsx`** — line 244
5. **`apps/customer-web/src/components/menu/menu-cart-sidebar.tsx`** — line 153

For each file:
- Read the file
- Find `?? 18` or `|| 18`
- Replace with `?? DEFAULT_TAX_PERCENTAGE`
- Add `import { DEFAULT_TAX_PERCENTAGE } from '@gustri/core';`

---

## Step 4: Fix Staff-Web Untranslated Labels

### 4a: Cafe Settings Tab Labels

**File:** `apps/staff-web/src/app/(staff)/cafe-settings/page.tsx`

Find tab definitions (~lines 182-185):
```typescript
const tabs = [
  { id: 'general', label: 'General', icon: Store },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'contact', label: 'Contact', icon: Phone },
] as const;
```

Replace with translated labels:
```typescript
const tabs = [
  { id: 'general', label: t('cafeSettings.tabs.general'), icon: Store },
  { id: 'branding', label: t('cafeSettings.tabs.branding'), icon: Palette },
  { id: 'contact', label: t('cafeSettings.tabs.contact'), icon: Phone },
] as const;
```

Note: `as const` may conflict with the `t()` return type. If so, remove `as const` or type the array differently.

Add to `packages/i18n/src/locales/en/staff.json`:
```json
"cafeSettings": {
  "tabs": {
    "general": "General",
    "branding": "Branding",
    "contact": "Contact"
  }
}
```

Add Japanese translations to `ja/staff.json`.

### 4b: `getCallTypeInfo` and `getPriorityInfo` English Labels

**File:** `apps/staff-web/src/hooks/use-waiter-calls-safe.ts`

These functions return hardcoded English labels like `'General Help'`, `'Request Bill'`, etc. They're exported but **never imported anywhere** (confirmed dead code in our review).

**Action:** Delete both functions entirely. They are dead code. If they were used, the fix would be to accept a `t` function parameter and return translation keys instead of English strings.

### 4c: `formatPaymentMethod` English Labels

**File:** `apps/staff-web/src/hooks/use-payments-safe.ts`

`formatPaymentMethod` returns `'Cash'`, `'Credit/Debit Card'`, `'Digital Payment'`. Also **never imported** (dead code).

**Action:** Delete the function entirely.

---

## Final Verification

```bash
pnpm type-check
pnpm test
pnpm check
```

Manual verification:
- Load customer-web — verify `<html lang>` updates when language changes
- Load cafe settings page — verify no `¥` flash on first load
- Load delivery page — verify cart sidebar shows correct tax (0% until settings load, then real value)

## Commit

Commit with message: `i18n: fix hardcoded currency/language defaults, dynamic html lang, remove dead i18n-incompatible helpers`
