# LOW Priority Fixes

> Issues that improve code quality and consistency but have minimal risk.
> Address when convenient or during related refactoring work.
> Estimated effort: 1-2 days total

---

## LOW-1: `console.log` Statements in Production Code

### Problem

14 `console.log` calls remain in production code, primarily in the notification
provider. These pollute the browser console and could leak internal state to
users who open DevTools.

### Primary File

- `apps/staff-web/src/components/providers/notification-provider.tsx`
  (lines 84, 118, 165, and ~11 others)

### Fix Plan

**Step 1:** Search for all console.log/console.warn in production code:

```bash
pnpm exec biome check --diagnostic-filter=lint/noConsole ./apps/ ./packages/
# Or manually:
grep -rn 'console\.\(log\|warn\|error\|info\|debug\)' apps/staff-web/src/ --include='*.ts' --include='*.tsx' | grep -v '__tests__' | grep -v '.test.'
```

**Step 2:** Replace each occurrence with the appropriate alternative:

```typescript
// For important operational info (subscription state, auth events):
import * as Sentry from '@sentry/nextjs';
Sentry.addBreadcrumb({ category: 'realtime', message: 'Channel connected', level: 'info' });

// For errors that should be tracked:
Sentry.captureMessage('Audio playback failed', 'warning');

// For debug-only logs during development:
if (process.env.NODE_ENV === 'development') {
  console.log('debug info');
}
// Or simply remove them if they serve no purpose.
```

**Step 3:** For audio playback failures specifically (`.catch(() => {})`),
add Sentry breadcrumbs so failed notifications are visible in error reports:

```typescript
// Before
audioRef.current.play().catch(() => {});

// After
audioRef.current.play().catch((err) => {
  Sentry.addBreadcrumb({
    category: 'audio',
    message: `Notification sound failed: ${err.message}`,
    level: 'warning',
  });
});
```

**Step 4:** Consider adding a Biome rule to catch new console statements:
The existing `noConsole` rule could be enabled at `warn` level in `biome.json`.

### Verification

- Browser console is clean in production mode
- Sentry captures audio/subscription breadcrumbs
- No console statements in production code (excluding test files)

---

## LOW-2: Storage Event Listeners Without Cleanup in Zustand Stores

### Problem

`apps/customer-web/src/store/cart-store.ts` and `delivery-store.ts` add
`window.addEventListener('storage', ...)` for cross-tab sync but never
remove the listener.

Since these are module-level singletons (not React components), the listeners
persist for the app lifetime — which is acceptable for a SPA. However, if
the stores are ever used in SSR or test environments, these listeners will
leak.

### Files to Change

- `apps/customer-web/src/store/cart-store.ts` (~line 98-109)
- `apps/customer-web/src/store/delivery-store.ts` (~line 50-62)

### Fix Plan

**Step 1:** Since these are global stores, the cleanup isn't strictly necessary.
But for correctness, export a cleanup function:

```typescript
// At the end of cart-store.ts
function handleStorageEvent(event: StorageEvent) {
  if (event.key === 'cart-storage') {
    try {
      const parsed = JSON.parse(event.newValue || '{}');
      useCartStore.setState(parsed.state || {});
    } catch {
      // Malformed storage data — ignore
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', handleStorageEvent);
}

// Export for cleanup in tests
export function cleanupCartStoreSync() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('storage', handleStorageEvent);
  }
}
```

**Step 2:** Apply same pattern to `delivery-store.ts`.

**Step 3:** Add `typeof window !== 'undefined'` guard to prevent SSR issues
(if not already present).

### Verification

- Cross-tab sync still works
- No console errors in SSR/test environments
- Test cleanup is possible

---

## LOW-3: Marketing App Has Weaker Security Headers

### Problem

`apps/marketing/next.config.js` only has 4 basic security headers, missing:
- `Permissions-Policy` (camera, microphone, geolocation restrictions)
- `Content-Security-Policy` (script/style/connect source restrictions)

Staff-web and customer-web have comprehensive headers. Marketing should match
since it likely shares the same domain or subdomain.

### Files to Change

- `apps/marketing/next.config.js`

### Fix Plan

**Step 1:** Add the missing headers. Marketing is simpler (no Supabase,
no Sentry), so the CSP can be tighter:

```javascript
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};
```

**Step 2:** If marketing uses analytics (Google Analytics, Plausible, etc.),
add those domains to the CSP `script-src` and `connect-src` directives.

### Verification

- Marketing app loads correctly with new headers
- Browser DevTools shows all security headers
- No CSP violations in the console

---

## LOW-4: `tailwind-merge` Version Drift in UI Package

### Problem

`packages/ui/package.json:25` has `"tailwind-merge": "^2.2.0"` while
apps use `"^2.5.0"`. The `cn()` utility from UI package might behave
differently than expected.

### Files to Change

- `packages/ui/package.json` (line 25)

### Fix Plan

**Step 1:** Update to match apps:

```json
"tailwind-merge": "^2.5.0"
```

**Step 2:** Run `pnpm install` and verify no breaking changes.

### Verification

- `pnpm build --filter=@gustri/ui` succeeds
- Class merging behavior unchanged (spot-check in browser)

---

## LOW-5: Zod Version Constraint Drift

### Problem

`packages/database/package.json:24` has `"zod": "^3.22.4"` while
`apps/staff-web/package.json` has `"zod": "^3.23.0"`.

### Files to Change

- `packages/database/package.json` (line 24)

### Fix Plan

**Step 1:** Update database package to use the newer constraint:

```json
"zod": "^3.23.0"
```

**Step 2:** Run `pnpm install` and verify no breaking changes.

### Verification

- `pnpm build --filter=@gustri/database` succeeds
- Schema validation tests pass

---

## LOW-6: Marketing App Uses Pinned Next.js Version

### Problem

`apps/marketing/package.json` has `"next": "14.2.0"` (pinned) while other
apps use `"next": "^14.2.0"` (caret range).

### Files to Change

- `apps/marketing/package.json`

### Fix Plan

**Step 1:** Change to caret range for consistency:

```json
"next": "^14.2.0"
```

**Step 2:** Run `pnpm install` to get the latest 14.2.x.

### Verification

- Marketing app builds and runs correctly
- No breaking changes from minor version bump

---

## LOW-7: Biome Config Could Exclude Generated Directories

### Problem

`biome.json` only excludes `.claude/`. Generated directories like `.next/`,
`.expo/`, `dist/` could be processed unnecessarily.

### Files to Change

- `biome.json`

### Fix Plan

**Step 1:** Verify if Biome already ignores these via default behavior.
Biome typically ignores `node_modules` by default. Check docs.

**Step 2:** If needed, update the includes/excludes:

```json
"files": {
  "includes": ["**"],
  "ignoreUnknown": true
}
```

Or add explicit excludes:

```json
"files": {
  "includes": ["**", "!.claude/", "!**/dist/", "!**/.next/", "!**/.expo/"]
}
```

### Verification

- `pnpm check` runs in the same time (no performance regression)
- No false positives from generated files

---

## Execution Order

1. **LOW-4** (tailwind-merge) — 2 min, one-line fix
2. **LOW-5** (zod version) — 2 min, one-line fix
3. **LOW-6** (next.js pinning) — 2 min, one-line fix
4. **LOW-3** (marketing headers) — 15 min, security consistency
5. **LOW-1** (console.log cleanup) — 30 min, code quality
6. **LOW-2** (storage listeners) — 15 min, correctness
7. **LOW-7** (biome config) — 5 min, DX improvement

## Definition of Done

- [ ] No console.log in production code (excluding tests)
- [ ] Storage listeners have proper cleanup exports
- [ ] Marketing app has full security headers
- [ ] Dependency versions consistent across packages
- [ ] All tests pass, all builds succeed
