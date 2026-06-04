# CRITICAL Priority Fixes

> Issues that are actively broken or represent immediate security/reliability risks.
> Estimated effort: 1-2 days total

---

## CRIT-1: CI Heredoc Indentation Silently Breaks E2E Env Vars

### Problem

In `.github/workflows/ci.yml:166-179`, the `cat > .env.local << 'ENVEOF'` heredoc block
is indented with spaces inside the YAML step. Shell heredocs are whitespace-sensitive:
each env var line starts with `~10 leading spaces`, so the system reads them as:

```
          NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
```

That is NOT a valid env var name. The actual var name becomes
`          NEXT_PUBLIC_SUPABASE_URL` (with spaces), which means Next.js never sees
`NEXT_PUBLIC_SUPABASE_URL` at all. The E2E tests may be running against **no database**,
passing only because Playwright tests might be testing UI-only flows or silently failing
to connect.

### Files to Change

- `.github/workflows/ci.yml` (lines 166-179)

### Fix Plan

**UPDATE:** This was a false positive. YAML `run: |` (literal block scalar) automatically
strips the common leading indentation before passing to the shell. The heredoc content
lines were already correct — they appear at column 0 from the shell's perspective.

**Action taken:** Added a verification step to CI that validates env files after creation.
This serves as a safety net for future edits.

```yaml
      - name: Verify env files
        run: |
          grep -q '^NEXT_PUBLIC_SUPABASE_URL=' apps/staff-web/.env.local || (echo "FAIL" && exit 1)
          grep -q '^NEXT_PUBLIC_SUPABASE_URL=' apps/customer-web/.env.local || (echo "FAIL" && exit 1)
```

### Verification

- Push to a PR branch, check CI E2E job logs
- Confirm "Write env files" step output shows vars without leading whitespace
- Confirm E2E tests actually connect to local Supabase (check for real data assertions)

### Risk

Low risk fix. Only affects CI, not production. If broken further, E2E tests just fail.

---

## CRIT-2: Customer-Web Has No Middleware (No Edge Security)

### Problem

`apps/customer-web/` has NO `middleware.ts` file. This means:

1. **No security headers** enforced at the edge (CSP is only in `next.config.js` static headers)
2. **No CSRF/origin validation** for any requests
3. **No rate limiting at the edge** before requests hit the client
4. **If API routes are ever added to customer-web**, they'll be fully open

The customer-web app is a public-facing ordering interface (QR code flow). While it
delegates mutations to staff-web API routes (via `api-routes.ts` calling
`http://localhost:3001/api/v1/customer/*`), the app itself has no edge protection.

### Current Architecture Understanding

- Customer-web is a **client-side only** Next.js app (no API routes, no server actions)
- All mutations go through `apps/customer-web/src/lib/api-routes.ts` which calls
  staff-web's `/api/v1/customer/*` endpoints (these ARE rate-limited and validated)
- Reads use the Supabase client directly via RPC functions (RLS protected)
- Auth is anonymous (no user sessions, `persistSession: false`)

### Files to Create

- `apps/customer-web/src/middleware.ts` (new file)

### Fix Plan

**Step 1:** Create `apps/customer-web/src/middleware.ts` with the following concerns:

```typescript
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers (defense-in-depth, supplements next.config.js)
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icons/|manifest|.*\\.mp3$|.*\\.png$|.*\\.svg$|.*\\.webp$).*)',
  ],
};
```

**Step 2:** The middleware should be minimal since:
- Customer-web has NO API routes (mutations proxy through staff-web)
- There is no auth to enforce (anonymous ordering by design)
- Rate limiting is handled at the staff-web API layer

**Step 3:** If future API routes are ever added to customer-web, the middleware
MUST be extended with:
- Rate limiting (using Upstash or in-memory)
- Request validation
- Origin checking

### Verification

- `pnpm dev` in customer-web still works
- Security headers appear in browser DevTools Network tab
- Existing E2E tests still pass
- `pnpm build --filter=@gustri/customer-web` succeeds

### Risk

Very low risk. Adding a pass-through middleware with security headers cannot break
existing functionality.

---

## Execution Order

1. **CRIT-1 first** — This is a one-line-class fix that immediately improves CI reliability
2. **CRIT-2 second** — New file creation, no existing code modified

## Definition of Done

- [ ] CI heredoc produces correct env vars (verified in CI logs)
- [ ] E2E tests connect to real local Supabase (not running against empty config)
- [ ] Customer-web has middleware.ts with security headers
- [ ] All existing tests pass (`pnpm test`, `pnpm build`)
