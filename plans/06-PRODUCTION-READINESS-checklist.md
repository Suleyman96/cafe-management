# Production Readiness Checklist

> Items NOT covered by the fix plans (01-05). These require manual verification,
> infrastructure setup, or operational decisions before going live.
> Review each section and check off items as you verify them.

---

## 1. Infrastructure & Operations

- [ ] **Supabase production plan** — Free tier has connection limits (max ~60 direct connections),
  no SLA, and limited backups. Verify you're on Pro or Team plan for production workloads.

- [ ] **PII encryption key is set in production** — The migration `20260421000001_encrypt_customer_pii.sql`
  falls back to storing plaintext if `app.pii_encryption_key` is empty.
  - Check: Supabase Dashboard > Database > Settings
  - The key must be set via: `ALTER DATABASE postgres SET app.pii_encryption_key = 'your-strong-passphrase';`
  - Store a backup of this key in a secrets manager (AWS Secrets Manager, 1Password, etc.)
  - If the key is lost, encrypted customer data (names, phones, addresses) is **unrecoverable**

- [ ] **Upstash Redis provisioned for production** — The rate limiter (`apps/staff-web/src/lib/api/rate-limit.ts`)
  will crash if `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` are undefined.
  - Verify a production Upstash instance exists
  - Check the plan supports your expected request volume
  - Ensure the region matches your Vercel deployment region for low latency

- [ ] **Vercel environment variables complete** — Cross-check against `.env.example` files:
  - `apps/staff-web/.env.example` (19 vars including Supabase, Sentry, Upstash, customer web URL)
  - `apps/customer-web/.env.example` (13 vars including Supabase, Sentry, API base URL)
  - Verify all are set in Vercel Dashboard > Project > Settings > Environment Variables
  - Ensure `NEXT_PUBLIC_CUSTOMER_WEB_URL` in staff-web points to the actual customer-web domain

- [ ] **Custom domains + SSL** — Configure for both apps:
  - Staff-web (e.g., `app.gustri.com` or `staff.gustri.com`)
  - Customer-web (e.g., `order.gustri.com`)
  - Vercel handles SSL automatically, but verify certificates are active

- [ ] **Database backups verified** — Supabase Pro includes point-in-time recovery (PITR).
  - Verify PITR is enabled in Supabase Dashboard > Database > Backups
  - Test a restore at least once before launch to confirm it works
  - Document the restore procedure for your team

- [ ] **Supabase connection pooling** — For production, ensure your `NEXT_PUBLIC_SUPABASE_URL`
  uses the REST API endpoint (default), not a direct PostgreSQL connection. The Supabase JS
  client uses REST by default, so this is likely correct — but verify.

- [ ] **Edge function regions** — Verify Vercel deployments are in a region close to your
  Supabase instance to minimize latency. Check Vercel > Project > Settings > Functions > Region.

- [ ] **Supabase REST API rate limiting** — Customer-web makes direct Supabase REST calls
  using the anon key (reads via RLS). Client-side throttling is in place (`supabase.ts`
  limits to 20 req/10s, `api-routes.ts` limits to 5 POST/30s), but these are bypassable.
  Configure server-side limits in Supabase Dashboard:
  - Dashboard > Settings > API > Rate Limiting
  - Set per-IP request limits for the REST API (recommended: 100 req/min)
  - Set per-IP connection limits for Realtime WebSockets (recommended: 10 concurrent)
  - Set global connection pool limits appropriate for your plan tier
  - Test that normal customer ordering flows (menu browse, place order, track status)
    stay well under the limits — a typical session is ~20-30 requests

---

## 2. Testing Gaps

- [ ] **E2E coverage for critical flows** — Current coverage:
  - Customer-web: 3 specs (menu, order-flow, waiter-call)
  - Staff-web: 4 specs (auth, order-lifecycle, orders, security)

  Missing E2E tests for:
  - [ ] Payment processing (full, partial, split)
  - [ ] Delivery order complete flow (create -> assign -> deliver)
  - [ ] Table management (create, transfer, close)
  - [ ] Menu item CRUD (create, edit, delete, reorder)
  - [ ] Staff management (create, deactivate, role change)
  - [ ] Refund flow
  - [ ] Multi-language switching

- [ ] **Load testing** — A busy restaurant could have 50+ concurrent QR code orders.
  - Run a load test with tools like k6, Artillery, or Playwright's `--workers` flag
  - Target: 50 concurrent order creations via customer-web
  - Monitor: Supabase connection count, response times, error rates
  - Check that rate limiting works correctly under load (not too aggressive, not too lenient)

- [ ] **Mobile E2E tests** — The mobile app has 22 unit tests but zero E2E tests.
  - Consider Detox or Maestro for critical flows before app store submission

- [ ] **Multi-tenancy testing** — RLS policies use `current_tenant_id()` for isolation.
  - Create two test tenants with overlapping data
  - Verify tenant A cannot see tenant B's orders, tables, menu items, staff
  - Test this both via the UI and directly via Supabase RPC calls

---

## 3. Payment & Financial Edge Cases

- [ ] **Concurrent payment on same order** — What happens if two waiters try to
  process payment for the same order simultaneously? Test for race conditions.

- [ ] **Split payment edge cases** — Test:
  - Split by items where some items are already paid
  - Partial amount that exceeds remaining balance
  - Split payment + discount combination
  - Payment cancellation mid-split

- [ ] **Refund edge cases** — Test:
  - Refund amount exceeding original payment
  - Refund after partial payment
  - Multiple refunds on the same order
  - Refund on a closed/cancelled order

- [ ] **Currency precision** — The migration `20260418100001_upgrade_decimal_precision.sql`
  upgraded decimal precision. Verify that:
  - Rounding is consistent between frontend calculations and database
  - Tax calculations don't accumulate floating-point errors
  - Receipt totals match the sum of line items

- [ ] **Financial audit log** — The `financial_audit_log` table tracks all order
  total changes. Verify:
  - Every mutation that changes an order total creates an audit entry
  - Audit entries are immutable (no UPDATE/DELETE policies)
  - Only admin/owner roles can read the audit log

---

## 4. Offline & Network Resilience

- [ ] **Waiter device loses WiFi mid-order** — What happens?
  - Does the mobile app queue mutations for retry?
  - Does the staff-web dashboard show a connection lost indicator?
  - Are there data conflicts when reconnecting?

- [ ] **Supabase Realtime disconnection** — The realtime sync hook
  (`use-realtime-sync.ts`) has retry logic with exponential backoff.
  - Verify it actually reconnects after network interruption
  - Verify the fallback polling kicks in if WebSocket stays down
  - Test by temporarily blocking WebSocket connections in DevTools

- [ ] **Customer QR code ordering during outage** — If staff-web is down:
  - Customer-web calls staff-web's API for mutations
  - Those calls will fail — does customer-web show a user-friendly error?
  - Is there a retry mechanism or does the customer have to start over?

---

## 5. Compliance & Legal

- [ ] **GDPR / KVKK data deletion** — PII encryption is in place, but:
  - Can a customer request their data be erased? (Right to erasure)
  - Is there a process to delete a customer's order history, name, phone, address?
  - Document the manual procedure at minimum

- [ ] **Cookie consent** — Customer-web uses Supabase which may set cookies.
  - If serving EU customers, a cookie consent banner may be required
  - Supabase anon client with `persistSession: false` avoids auth cookies,
    but verify no analytics or tracking cookies are set

- [ ] **Payment card data** — Verify you NEVER store raw card numbers.
  - The `payment_method` field stores type (cash/card/digital), not card details
  - If using a payment terminal integration, ensure PCI-DSS compliance
  - Document that card processing is handled by the terminal/gateway, not your app

- [ ] **Data retention policy** — How long do you keep:
  - Order history?
  - Customer PII (names, phones, addresses)?
  - Financial audit logs?
  - Define retention periods and implement automated cleanup if needed

---

## 6. Accessibility (a11y)

- [ ] **Customer-web WCAG compliance** — This is the public-facing app. At minimum:
  - [ ] All images have alt text
  - [ ] Color contrast meets WCAG AA (4.5:1 for text)
  - [ ] Interactive elements are keyboard-navigable
  - [ ] Form inputs have associated labels
  - [ ] Error messages are announced to screen readers
  - Note: Biome a11y rules are mostly disabled (`noStaticElementInteractions: off`,
    `useKeyWithClickEvents: off`, etc. in `biome.json`). Consider enabling them
    for customer-web at minimum.

- [ ] **Mobile app accessibility** — React Native has built-in accessibility props.
  - Verify `accessibilityLabel` is set on interactive elements
  - Test with VoiceOver (iOS) or TalkBack (Android)

---

## 7. Monitoring & Alerting

- [ ] **Sentry alerts configured** — Error tracking without alerting means nobody
  sees errors in real-time.
  - Set up Slack or email alerts for error spikes
  - Configure alert rules: e.g., >10 errors in 5 minutes = alert
  - Set up performance monitoring alerts for slow API routes

- [ ] **Uptime monitoring** — Who gets paged if the app goes down at 8pm Friday?
  - Set up monitoring on health check endpoints (after MED-2 is implemented)
  - Tools: Vercel Analytics, UptimeRobot, Better Stack, or Checkly
  - Configure SMS/phone alerts for critical downtime

- [ ] **Database monitoring** — Watch for:
  - Slow queries (enable `pg_stat_statements` in Supabase)
  - Connection pool exhaustion
  - Storage approaching limits
  - Supabase Dashboard > Reports shows some of this

- [ ] **Real-time subscription health** — The app relies heavily on Supabase Realtime.
  - Monitor WebSocket connection counts
  - Alert if subscription error rate spikes
  - Supabase Dashboard > Realtime > Inspector can help debug

- [ ] **Rate limiter monitoring** — Track how often rate limits are hit.
  - If legitimate users are being rate-limited, the limits are too aggressive
  - If the limits are never hit, they might be too lenient
  - Upstash Dashboard shows rate limit analytics

---

## 8. Deployment & Rollback

- [ ] **Deployment process documented** — Can a new team member deploy?
  - Document: push to main -> CI passes -> auto-deploy to Vercel
  - Document: how to rollback a bad deployment (Vercel instant rollback)
  - Document: how to rollback a bad database migration

- [ ] **Staging environment** — Do you have one?
  - Ideally: separate Supabase project + separate Vercel project
  - Deploy PRs to preview URLs (Vercel does this automatically)
  - Run E2E tests against staging before promoting to production

- [ ] **Database migration process** — Supabase migrations run automatically
  on `supabase db push` or via the dashboard.
  - Document: how migrations are applied in production
  - Document: who has access to run migrations
  - Test migrations against a copy of production data before applying

- [ ] **Feature flags** — For high-risk features (e.g., new payment flow):
  - Consider a simple feature flag system (env var or `cafe_settings` row)
  - Allows quick disable without redeployment

---

## 9. Performance Baselines

- [ ] **Measure current performance** before launch:
  - [ ] Staff-web Time to Interactive (TTI): target < 3s
  - [ ] Customer-web TTI: target < 2s (customers on mobile)
  - [ ] API route response times: target < 500ms p95
  - [ ] Order creation end-to-end: target < 1s
  - [ ] Realtime event propagation: target < 500ms

- [ ] **Bundle size audit** — Run `next build` and check the output:
  - Are there unexpectedly large chunks?
  - Are all locale files bundled even though only one is needed?
  - Is `recharts` (used in staff-web) tree-shaken properly?

---

## Summary: Launch Readiness Score

After implementing all fix plans (01-05), score yourself:

| Category | Weight | Ready? |
|----------|--------|--------|
| Code quality & security | 30% | Plans cover this |
| Infrastructure setup | 20% | Section 1 above |
| Testing confidence | 15% | Section 2-3 above |
| Monitoring & alerting | 15% | Section 7 above |
| Compliance | 10% | Section 5 above |
| Deployment process | 10% | Section 8 above |

**Minimum viable launch:** Sections 1 + 7 (infrastructure + monitoring) are
non-negotiable. The rest can be addressed incrementally after launch if needed,
but should be on your roadmap.
