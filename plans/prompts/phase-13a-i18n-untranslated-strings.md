# Phase 13A: Hardcoded Strings — Fix Untranslated English in Customer-Web & Mobile

## Goal

Multiple customer-facing and mobile UI strings are hardcoded in English instead of using the `t(...)` i18n function. Fix by adding translation keys and wrapping all user-visible strings.

## Important

- Read each file before editing
- Translation keys go in `packages/i18n/src/locales/{lang}/{namespace}.json`
- Customer-web uses namespaces: `common`, `customer`
- Mobile uses namespaces: `common`, `staff`
- Add keys to at minimum `en` and `ja` locale files
- Run `pnpm type-check` after changes
- Do NOT change visual appearance — only wrap strings in `t(...)`

---

## Step 1: Customer-Web — Delivery Layout

**File:** `apps/customer-web/src/app/delivery/layout.tsx`

### 1a: "Cart" button label — line 39

Find the hardcoded `Cart` text in JSX. Replace with `t('customer:delivery.cart')`.

Read the file to see if `useTranslation` is already imported. If not, add:
```typescript
const { t } = useTranslation();
```

### 1b: "Restaurant" fallback — line 33

Find:
```tsx
{settings?.restaurant_name || 'Restaurant'}
```

Replace fallback with translated string:
```tsx
{settings?.restaurant_name || t('customer:delivery.restaurantFallback')}
```

### Add translation keys

**File:** `packages/i18n/src/locales/en/customer.json`
```json
"delivery": {
  "cart": "Cart",
  "restaurantFallback": "Restaurant"
}
```

**File:** `packages/i18n/src/locales/ja/customer.json`
```json
"delivery": {
  "cart": "カート",
  "restaurantFallback": "レストラン"
}
```

Read the existing JSON structure first — the `delivery` key may already exist with other entries. Merge into the existing object.

---

## Step 2: Customer-Web — Table Landing Page

**File:** `apps/customer-web/src/components/table/table-landing.tsx`

### 2a: "QR ordering is not available." — line 366

Find:
```tsx
<p className="text-sm font-medium text-white/70">QR ordering is not available.</p>
```

Replace with:
```tsx
<p className="text-sm font-medium text-white/70">{t('customer:tableLanding.qrNotAvailable')}</p>
```

### 2b: "Please order at the counter." — line 367

Find:
```tsx
<p className="text-xs text-white/40 mt-1">Please order at the counter.</p>
```

Replace with:
```tsx
<p className="text-xs text-white/40 mt-1">{t('customer:tableLanding.orderAtCounter')}</p>
```

### 2c: "Powered by gustri" footer — lines 512-516

Find:
```tsx
<p className="text-xs text-white/20 font-light">
  Powered by{' '}
  <span ...>gustri</span>
</p>
```

This is a brand footer. Options:
- **Option A (recommended):** Keep "gustri" as brand name but translate "Powered by": `{t('customer:tableLanding.poweredBy')} gustri`
- **Option B:** Check if there's a `PlatformFooter` component used elsewhere. Read `apps/customer-web/src/components/` for a `PlatformFooter` component. If it exists and is already translated, replace this inline markup with `<PlatformFooter />`.

### 2d: "items" fallback — line 327

Find the fallback `|| 'items'`. Replace with `|| t('customer:tableLanding.items')`.

### Add translation keys

**File:** `packages/i18n/src/locales/en/customer.json` — add:
```json
"tableLanding": {
  "qrNotAvailable": "QR ordering is not available.",
  "orderAtCounter": "Please order at the counter.",
  "poweredBy": "Powered by",
  "items": "items"
}
```

**File:** `packages/i18n/src/locales/ja/customer.json` — add Japanese translations for the same keys.

Read existing `customer.json` files to check if `tableLanding` keys already exist and merge.

---

## Step 3: Customer-Web — `timeAgo()` Utility

**File:** `apps/customer-web/src/lib/utils.ts`

Find `timeAgo()` function (~lines 27-38):
```typescript
if (minutes < 1) return 'just now';
if (minutes < 60) return `${minutes} min ago`;
if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
return `${days} day${days > 1 ? 's' : ''} ago`;
```

This function returns hardcoded English strings and is called from components that render the result directly.

### Fix option:

`timeAgo` is a pure utility function — it can't use `useTranslation()` hook. Two approaches:

**Option A (recommended):** Accept a translation function as parameter:
```typescript
export function timeAgo(dateString: string, t: (key: string, opts?: Record<string, string | number>) => string): string {
  const now = new Date();
  const date = new Date(dateString);
  const minutes = getElapsedMinutes(date, now);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return t('customer:time.justNow');
  if (minutes < 60) return t('customer:time.minutesAgo', { count: minutes });
  if (hours < 24) return t('customer:time.hoursAgo', { count: hours });
  return t('customer:time.daysAgo', { count: days });
}
```

Then update all callers to pass `t`:
- Read where `timeAgo` is called (likely `order-status.tsx` and `delivery-order-status.tsx`)
- Change `timeAgo(dateStr)` to `timeAgo(dateStr, t)`

**Option B:** Return a key + params and let the caller translate:
```typescript
export function timeAgo(dateString: string): { key: string; params: Record<string, number> } { ... }
```

Option A is simpler. Go with it.

### Add translation keys

**File:** `packages/i18n/src/locales/en/customer.json` — add:
```json
"time": {
  "justNow": "just now",
  "minutesAgo": "{{count}} min ago",
  "hoursAgo": "{{count}} hour ago",
  "hoursAgo_plural": "{{count}} hours ago",
  "daysAgo": "{{count}} day ago",
  "daysAgo_plural": "{{count}} days ago"
}
```

Check if the i18n setup uses i18next plural rules (`_plural` suffix or `count` interpolation). Read `packages/i18n/` setup to confirm the pluralization approach.

---

## Step 4: Mobile — OfflineBanner

**File:** `apps/mobile/src/components/OfflineBanner.tsx`

Find line 15:
```tsx
<Text style={styles.text}>You're offline — changes will sync when connected</Text>
```

Replace with:
```tsx
<Text style={styles.text}>{t('common:offline.message')}</Text>
```

Add `useTranslation` import. Read the file to see if the component is a function component (hooks work) or class component.

### Add translation key

**File:** `packages/i18n/src/locales/en/common.json` — add:
```json
"offline": {
  "message": "You're offline — changes will sync when connected"
}
```

**File:** `packages/i18n/src/locales/ja/common.json` — add Japanese translation.

---

## Step 5: Mobile — ErrorBoundary

**File:** `apps/mobile/src/components/ErrorBoundary.tsx`

This is a **class component** — it cannot use `useTranslation()` hook.

Find hardcoded strings at lines 38, 41, 43:
```tsx
"Something went wrong"
"An unexpected error occurred. Please restart the app."
"Try again"
```

### Fix options:

**Option A (simplest):** Use `i18next` directly (without hook):
```typescript
import i18n from '@/lib/i18n';

// In render():
<Text ...>{i18n.t('common:error.title')}</Text>
<Text ...>{i18n.t('common:error.message')}</Text>
<Button ...>{i18n.t('common:error.tryAgain')}</Button>
```

Read how `i18n` is exported from `apps/mobile/src/lib/i18n.ts`. If it exports the i18n instance directly, this works. If not, import from `i18next` package directly.

**Option B:** Extract strings to constants that are resolved at render time. Less ideal.

Go with Option A.

### Add translation keys

**File:** `packages/i18n/src/locales/en/common.json`:
```json
"error": {
  "title": "Something went wrong",
  "message": "An unexpected error occurred. Please restart the app.",
  "tryAgain": "Try again"
}
```

---

## Step 6: Mobile — PendingSyncBadge

**File:** `apps/mobile/src/components/PendingSyncBadge.tsx`

Find line 18:
```tsx
<Text style={styles.text}>{pendingMutations.length} pending</Text>
```

Replace with:
```tsx
<Text style={styles.text}>{t('common:sync.pending', { count: pendingMutations.length })}</Text>
```

Add `useTranslation` if not already imported.

### Add translation key

```json
"sync": {
  "pending": "{{count}} pending"
}
```

---

## Step 7: Mobile — SchedulesScreen Wrong Namespace + Hardcoded Plurals

**File:** `apps/mobile/src/screens/schedules/SchedulesScreen.tsx`

### 7a: Wrong namespace — lines 238, 255

Find:
```tsx
{t('expenses.prev')}
{t('expenses.next')}
```

Check if `common.prev` / `common.next` keys exist in the locale files. If so, replace:
```tsx
{t('common:prev')}
{t('common:next')}
```

If not, check if `schedules.prev` / `schedules.next` exist. If neither exists, add keys to `common.json`:
```json
"prev": "Previous",
"next": "Next"
```

### 7b: Hardcoded plural — line 336

Find:
```tsx
{dailySchedules.length} schedule{dailySchedules.length !== 1 ? 's' : ''}
```

Replace with:
```tsx
{t('staff:schedules.scheduleCount', { count: dailySchedules.length })}
```

Add translation key to `packages/i18n/src/locales/en/staff.json`:
```json
"schedules": {
  "scheduleCount": "{{count}} schedule",
  "scheduleCount_plural": "{{count}} schedules"
}
```

---

## Final Verification

```bash
pnpm type-check
pnpm test
pnpm check
```

Verify translations render correctly:
- Customer-web: delivery layout, table landing page, order status time display
- Mobile: toggle airplane mode (offline banner), schedules screen

## Commit

Commit with message: `i18n: replace hardcoded English strings with translation keys in customer-web and mobile`
