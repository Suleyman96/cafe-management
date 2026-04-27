# Phase 11C: Error Handling — Remove `console.*` from Production Code

## Goal

Remove all `console.log`, `console.warn`, and `console.error` calls from production source files. Replace with Sentry where the error matters, or remove entirely where redundant (e.g., mutation `onError` handlers that are already covered by a global sync error handler).

## Important

- Read each file before editing
- Determine whether each console call should become Sentry, a toast, or nothing
- Run `pnpm type-check && pnpm test` after all changes
- Do NOT touch test files, config files, or build scripts

---

## Step 1: Staff-Web — 5 Console Calls

### 1a: `src/components/pwa/service-worker-registration.tsx` — line 12

```typescript
console.log('Service Worker registered:', registration.scope);
```

**Action:** Remove entirely. Service worker registration success is not worth logging in production. If observability is needed, add a Sentry breadcrumb instead:

```typescript
Sentry.addBreadcrumb({
  category: 'pwa',
  message: `Service Worker registered: ${registration.scope}`,
  level: 'info',
});
```

Or simply delete the line. Read the surrounding code to decide if Sentry is already imported.

### 1b: `src/lib/api/validate.ts` — line 19

```typescript
console.warn('[Validation]', JSON.stringify(result.error.issues));
```

**Action:** Remove. The validation issues are returned in the 400 response body — logging them to server console is redundant. The caller already gets the structured error.

### 1c: `src/lib/i18n.ts` — line 186

```typescript
console.warn(`No translations available for language: ${lang}`);
```

**Action:** Replace with Sentry breadcrumb or remove. This fires when a user selects a language that has no translation file — it's useful for debugging but shouldn't pollute production logs:

```typescript
Sentry.addBreadcrumb({
  category: 'i18n',
  message: `No translations available for language: ${lang}`,
  level: 'warning',
});
```

Or simply remove if i18n fallback behavior is sufficient.

### 1d: `src/hooks/use-auth.ts` — line 54

```typescript
loadAndSwitchLanguage(staffData.preferred_language).catch(console.warn);
```

**Action:** Replace `.catch(console.warn)` with a silent catch or Sentry:

```typescript
loadAndSwitchLanguage(staffData.preferred_language).catch((err) => {
  Sentry.captureException(err);
});
```

Language loading failure during login is non-critical (the app falls back to default language), so no toast is needed.

### 1e: `src/app/login/dev-login-button.tsx` — line 77

```typescript
console.error('Dev login error:', err);
```

**Action:** This is a dev-only component. Check if this component is rendered in production (look for `process.env.NODE_ENV` guards or conditional rendering). If it's dev-only, leave it. If it could render in production, replace with Sentry:

```typescript
Sentry.captureException(err);
```

---

## Step 2: Customer-Web — 3 Console Calls

### 2a: `src/lib/i18n.ts` — line 118

```typescript
console.warn(`No translations available for language: ${lang}`);
```

**Action:** Same as staff-web — remove or replace with Sentry breadcrumb.

### 2b: `src/lib/i18n.ts` — line 128

```typescript
console.warn(`Failed to load translations for ${lang}, falling back to Japanese`, err);
```

**Action:** Replace with Sentry since this indicates a real failure:

```typescript
Sentry.captureException(err, {
  extra: { language: lang, fallback: 'ja' },
});
```

### 2c: `src/components/table/table-landing.tsx` — line 59

```typescript
.catch(console.warn)
```

**Action:** This was already addressed in Phase 11B (Step 3). If Phase 11B has been completed, this is already fixed. If not, replace with:

```typescript
.catch((err: unknown) => {
  Sentry.captureException(err);
})
```

---

## Step 3: Mobile — 5 Console Calls in Mutation Hooks

These are all `console.error` in `onError` callbacks of React Query mutations. The mobile app has a global sync error handler at `apps/mobile/src/lib/sync-handler.ts` that already captures mutation errors via Sentry. These `console.error` calls are redundant.

### 3a: `src/hooks/use-create-order.ts` — line 23

```typescript
onError: (error: Error) => {
  console.error('Failed to create order:', error.message);
},
```

**Action:** Remove `console.error`. Check if the global error handler already covers this. If so, the `onError` callback can be removed entirely (unless it does something else like showing a toast). If it only has `console.error`, remove the entire `onError` block:

```typescript
// Remove the onError callback entirely — global sync handler covers it
```

Or if you want per-mutation Sentry context:
```typescript
onError: (error: Error) => {
  Sentry.captureException(error, { extra: { context: 'createOrder' } });
},
```

### 3b: `src/hooks/use-payments.ts` — line 41

```typescript
console.error('Failed to create payment:', error.message);
```

**Action:** Same — remove or replace with Sentry.

### 3c: `src/hooks/use-stock.ts` — line 76

```typescript
console.error('Failed to adjust stock:', error.message);
```

**Action:** Same.

### 3d: `src/hooks/use-cafe-settings.ts` — line 18

```typescript
console.error('Failed to update cafe settings:', error.message);
```

**Action:** Same.

### 3e: `src/hooks/use-waiter-calls.ts` — line 120

```typescript
console.error('Failed to update waiter call:', error.message);
```

**Action:** Same.

---

## Step 4: Verify No New Console Calls Were Missed

After all changes, run a search to confirm no production `console.*` calls remain:

```bash
grep -rn "console\.\(log\|warn\|error\)" apps/staff-web/src/ apps/customer-web/src/ apps/mobile/src/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "__tests__" \
  | grep -v "\.test\." \
  | grep -v "\.spec\." \
  | grep -v "node_modules"
```

If any remain, evaluate each one and either remove, replace with Sentry, or add a `// intentional` comment if there's a good reason to keep it (e.g., critical startup diagnostics).

---

## Final Verification

```bash
pnpm type-check
pnpm test
pnpm check
```

## Commit

Commit with message: `fix: remove console.log/warn/error from production code, replace with Sentry where needed`
