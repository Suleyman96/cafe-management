# Production Launch Plan

> Generated: 2026-04-24
> Status: Post-architecture fixes, pre-launch
> Scope: Web deployment + mobile store submission + operational readiness

---

## Overview

| Part | Focus | Effort | Blocks launch? |
|------|-------|--------|----------------|
| [Part 1](#part-1-infrastructure--env-setup) | Infrastructure & env setup | 1 day | YES — web launch |
| [Part 2](#part-2-legal--compliance) | Legal & compliance pages | 1 day | YES — store submission |
| [Part 3](#part-3-web-deployment) | Web deployment (Vercel) | 0.5 day | YES — web launch |
| [Part 4](#part-4-mobile-store-prep) | Mobile store preparation | 2-3 days | YES — store submission |
| [Part 5](#part-5-monitoring--alerting) | Monitoring & alerting | 0.5 day | NO — but do before real traffic |
| [Part 6](#part-6-soft-launch) | Soft launch (1-2 cafes) | 1 week | YES — before scaling |
| [Part 7](#part-7-payment-integration) | Payment gateway integration | 3-5 days | DEPENDS — only if in-app card payments needed |
| [Part 8](#part-8-email-notifications) | Email notifications | 1-2 days | NO — push + realtime cover critical path |
| [Part 9](#part-9-scale-to-100) | Scale to 100 cafes | ongoing | — |

**Minimum viable launch (web only): Parts 1 + 2 + 3 + 5 = ~3 days**
**Full launch (web + mobile): Parts 1-6 = ~2 weeks**

---

## Part 1: Infrastructure & Environment Setup

> Must be done before ANY deployment. ~1 day.

### 1.1 Supabase Production Instance

- [ ] **Upgrade to Supabase Pro plan** ($25/month)
  - Free tier limits: 500MB database, 2GB bandwidth, 50 concurrent connections
  - Pro provides: 8GB database, 250GB bandwidth, ~60 direct connections, PITR backups
  - Dashboard > Billing > Upgrade

- [ ] **Set PII encryption key**
  ```sql
  ALTER DATABASE postgres SET app.pii_encryption_key = 'your-strong-passphrase-here';
  ```
  - Store backup of this key in a secrets manager (1Password, AWS Secrets Manager)
  - If lost, encrypted customer data (names, phones, addresses) is UNRECOVERABLE
  - Dashboard > SQL Editor

- [ ] **Enable JWT custom claims auth hook**
  - Dashboard > Auth > Hooks > Custom Access Token
  - Set URI: `pg-functions://postgres/public/custom_access_token_hook`
  - Test: login → decode JWT → verify `staff_id`, `tenant_id`, `user_role` present

- [ ] **Configure connection pooling**
  - Dashboard > Database > Connection Pooling
  - Mode: Transaction (NOT Session)
  - Verify apps use the pooled connection string (port 6543 for direct, REST API is default)

- [ ] **Apply all migrations**
  ```bash
  supabase link --project-ref YOUR_PROJECT_REF
  supabase db push
  ```
  - Verify all 13 new migrations apply cleanly
  - Run `SELECT * FROM get_table_stats();` to verify monitoring functions work

- [ ] **Deploy Edge Function**
  ```bash
  supabase functions deploy send-push --project-ref YOUR_PROJECT_REF
  ```
  - Test: call the function manually with a test tenant_id

- [ ] **Configure push notification webhooks**
  - Dashboard > Database > Webhooks
  - Webhook 1: `push-new-order` — table: `orders`, event: INSERT, URL: `https://<project>.supabase.co/functions/v1/send-push`
  - Webhook 2: `push-waiter-call` — table: `waiter_calls`, event: INSERT, URL: same
  - Add Authorization header: `Bearer <SUPABASE_ANON_KEY>`

- [ ] **Verify PITR backups enabled**
  - Dashboard > Database > Backups
  - Test a point-in-time restore at least once (use a test project, not production)

### 1.2 Upstash Redis (Rate Limiting)

- [ ] **Create Upstash Redis instance** (upstash.com)
  - Region: same as Vercel deployment (e.g., eu-west-1 for Europe, us-east-1 for US)
  - Plan: Pay-as-you-go is fine for start
  - Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
  - ⚠️ **Without this, rate limiting is disabled** — all API endpoints accept unlimited requests
  - Rate limiting protects: order creation (30/min), payments (20/min), staff management (10/min), password resets (5/5min)
  - The app works without it (graceful fallback), but production should have it to prevent abuse

### 1.3 Sentry Projects

- [ ] **Create Sentry projects** (sentry.io)
  - Project 1: `gustri-staff-web` (Next.js)
  - Project 2: `gustri-customer-web` (Next.js)
  - Project 3: `gustri-mobile` (React Native)
  - Copy DSN for each project
  - Create auth token for source map uploads

### 1.4 Vercel Environment Variables

Set ALL variables in Vercel Dashboard > Project > Settings > Environment Variables:

**Staff-web (all required):**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  (⚠️ NEVER expose client-side)
NEXT_PUBLIC_CUSTOMER_WEB_URL=https://order.gustri.com
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
SENTRY_ORG=your-org
SENTRY_PROJECT=gustri-staff-web
SENTRY_AUTH_TOKEN=sntrys_...
```

**Customer-web (all required):**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_BASE_URL=https://app.gustri.com
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
SENTRY_ORG=your-org
SENTRY_PROJECT=gustri-customer-web
SENTRY_AUTH_TOKEN=sntrys_...
```

### 1.5 Custom Domains + SSL

- [ ] Staff-web: `app.gustri.com` (or `staff.gustri.com`)
- [ ] Customer-web: `order.gustri.com`
- [ ] Marketing: `gustri.com` (or `www.gustri.com`)
- [ ] Vercel handles SSL automatically — verify certificates are active after domain setup

### 1.6 EAS / Expo Configuration

- [ ] **Add `EXPO_TOKEN` to GitHub repo secrets**
  - expo.dev > Account Settings > Access Tokens > Create
  - GitHub repo > Settings > Secrets > Actions > New: `EXPO_TOKEN`

- [ ] **Set production env vars in eas.json** — currently preview/development profiles have local Supabase URLs. Add production env vars:
  ```json
  "production": {
    "autoIncrement": true,
    "android": { "buildType": "app-bundle" },
    "env": {
      "EXPO_PUBLIC_SUPABASE_URL": "https://xxxxx.supabase.co",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJ...",
      "EXPO_PUBLIC_API_BASE_URL": "https://app.gustri.com",
      "EXPO_PUBLIC_SENTRY_DSN": "https://xxxxx@sentry.io/xxxxx"
    }
  }
  ```

- [ ] **Remove hardcoded demo keys from app.json `extra` block** (lines 46-47)
  - These are local dev keys visible in the bundle — replace with empty strings or remove
  - Production values should come from `eas.json` env, not `app.json`

---

## Part 2: Legal & Compliance

> Required for both web launch and store submission. ~1 day.

### 2.1 Privacy Policy Page

- [ ] **Create `apps/marketing/src/app/privacy/page.tsx`**
  - Must cover: what data you collect, why, how it's stored, who has access, retention period, user rights (GDPR/KVKK)
  - Data you collect: staff accounts (email, name, phone), customer orders (name, phone, address for delivery), payment records (method, not card numbers)
  - PII encryption: mention customer data is encrypted at rest
  - Retention: orders archived after 24 months, PII anonymized after 12 months (per SCALE-25)
  - Host at: `https://gustri.com/privacy`

### 2.2 Terms of Service Page

- [ ] **Create `apps/marketing/src/app/terms/page.tsx`**
  - Service description, user responsibilities, liability limitations
  - Host at: `https://gustri.com/terms`

### 2.3 Cookie Consent (if serving EU customers)

- [ ] **Evaluate cookie usage**
  - Customer-web: `persistSession: false` — no auth cookies. But Supabase may set functional cookies.
  - Staff-web: session cookies for auth
  - If needed: add a simple cookie consent banner to customer-web

### 2.4 KVKK Compliance (Turkey-specific)

- [ ] **Data controller registration** — if operating in Turkey, register with KVKK (Personal Data Protection Authority)
- [ ] **Data processing inventory** — document what personal data flows through the system
- [ ] **Explicit consent** — delivery customers must consent to PII storage before placing an order

---

## Part 3: Web Deployment

> Deploy to Vercel. ~0.5 day (after Part 1 is done).

### 3.1 Staff-Web Deployment

- [ ] **Import project in Vercel**
  - Root directory: `apps/staff-web`
  - Framework: Next.js
  - Build command: `cd ../.. && pnpm build --filter=@gustri/staff-web`
  - Install command: `pnpm install`
  - All env vars from Part 1.4 set

- [ ] **Verify deployment**
  - `https://app.gustri.com/api/health` → `{ status: 'ok', db: 'connected' }`
  - Login with admin@test.com / test1234 → dashboard loads
  - Create a test order → realtime updates work
  - Check Sentry → no errors

### 3.2 Customer-Web Deployment

- [ ] **Import project in Vercel**
  - Root directory: `apps/customer-web`
  - Same build pattern
  - `NEXT_PUBLIC_API_BASE_URL` must point to the staff-web domain

- [ ] **Verify deployment**
  - `https://order.gustri.com/table/T01/menu` → menu loads with categories
  - Place a test order → appears in staff dashboard
  - QR code scanning flow works

### 3.3 Marketing Site Deployment

- [ ] **Import project in Vercel**
  - Root directory: `apps/marketing`
  - Verify privacy policy and terms pages load

### 3.4 Post-Deployment Checklist

- [ ] All security headers present (check with securityheaders.com)
- [ ] CSP blocks inline script injection (test in browser DevTools)
- [ ] Rate limiting works (hit `/api/v1/customer/orders` 35 times rapidly → 429)
- [ ] CORS only allows customer-web origin
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is NOT exposed in client-side bundle (check browser Network tab)

---

## Part 4: Mobile Store Preparation

> Preparing for Apple App Store and Google Play submission. ~2-3 days.

### 4.1 Apple Developer Account

- [ ] **Enroll in Apple Developer Program** ($99/year)
  - developer.apple.com/programs/enroll
  - Takes 24-48 hours for approval

- [ ] **Create App ID** in Apple Developer portal
  - Bundle ID: `com.gustri.app`
  - Enable capabilities: Push Notifications

- [ ] **Create provisioning profiles + certificates**
  - EAS handles this automatically with `eas credentials`
  - Run: `cd apps/mobile && eas credentials --platform ios`

### 4.2 Google Play Developer Account

- [ ] **Register Google Play Console** ($25 one-time)
  - play.google.com/console/signup
  - Create app: "Gustri"

- [ ] **Create Google Service Account key** for automated uploads
  - Google Cloud Console > IAM > Service Accounts
  - Grant "Service Account User" role
  - Download JSON key → save as `apps/mobile/google-service-account.json`
  - Add to `.gitignore` (NEVER commit this file)

- [ ] **Verify `google-service-account.json` path in eas.json** (line 35) matches

### 4.3 App Store Metadata

**For BOTH stores, prepare:**

- [ ] **App name:** Gustri
- [ ] **Short description** (80 chars): "Restaurant staff management — orders, tables, kitchen, and delivery"
- [ ] **Full description** (4000 chars): Write compelling store description
- [ ] **Category:** Food & Drink (primary), Business (secondary)
- [ ] **Keywords:** restaurant management, order management, POS, kitchen display, waiter app
- [ ] **Support URL:** `https://gustri.com/contact`
- [ ] **Privacy policy URL:** `https://gustri.com/privacy`

### 4.4 Screenshots

**Apple App Store requires:**
- [ ] 6.7" (iPhone 15 Pro Max): 1290 × 2796px — minimum 3, recommended 5-10
- [ ] 6.5" (iPhone 14 Plus): 1284 × 2778px
- [ ] 5.5" (iPhone 8 Plus): 1242 × 2208px — if supporting older phones
- [ ] iPad 12.9" (if `supportsTablet: true`): 2048 × 2732px

**Google Play requires:**
- [ ] Phone: 1080 × 1920px (or higher) — minimum 2, recommended 4-8
- [ ] 7" tablet: 1200 × 1920px
- [ ] 10" tablet: 1920 × 1200px

**Recommended screenshots (same content, different sizes):**
1. Orders list — "Manage all orders in real-time"
2. Kitchen display — "Kitchen sees what to prepare next"
3. Tables overview — "Know which tables are free"
4. Order detail — "Track every item's status"
5. Delivery management — "Handle delivery orders effortlessly"

### 4.5 App Configuration Fixes

- [ ] **Add iOS minimum deployment target** to `app.json`:
  ```json
  "ios": {
    "supportsTablet": true,
    "bundleIdentifier": "com.gustri.app",
    "infoPlist": {
      "NSAppTransportSecurity": {
        "NSAllowsArbitraryLoads": false
      }
    },
    "config": {
      "usesNonExemptEncryption": false
    }
  }
  ```
  `usesNonExemptEncryption: false` — avoids the export compliance prompt in App Store Connect (your app uses HTTPS but not custom encryption)

- [ ] **Add Android target SDK** to `app.json`:
  ```json
  "android": {
    "adaptiveIcon": { ... },
    "package": "com.gustri.app",
    "permissions": ["NOTIFICATIONS", "VIBRATE"],
    "versionCode": 1
  }
  ```
  EAS sets targetSdkVersion automatically based on Expo SDK version. Expo 54 targets API 34 (Android 14).

- [ ] **Remove hardcoded Supabase demo keys from app.json lines 46-47**
  ```json
  "extra": {
    "router": { "origin": false },
    "eas": { "projectId": "c0780054-a6d7-4e65-8ead-1a4b09f661a5" }
  }
  ```
  Production env vars come from `eas.json` build profiles, not `app.json`.

### 4.6 App Store Submission

- [ ] **Apple (TestFlight first):**
  ```bash
  cd apps/mobile
  eas build --profile production --platform ios
  eas submit --platform ios
  ```
  - TestFlight review takes ~24 hours
  - After TestFlight approval, submit for App Store review (1-3 days)

- [ ] **Google Play (Internal testing first):**
  ```bash
  cd apps/mobile
  eas build --profile production --platform android
  eas submit --platform android
  ```
  - Internal testing track (configured in eas.json) — instant availability
  - Promote to production after testing (Google review: 1-7 days for first submission)

### 4.7 App Store Data Disclosures

**Apple — App Privacy (App Store Connect > App Privacy):**
- [ ] Data collected: Name (delivery), Phone (delivery), Email (staff auth)
- [ ] Purpose: App functionality
- [ ] Linked to identity: No (we don't track users across apps)
- [ ] Data used for tracking: No

**Google — Data Safety Form (Play Console > App content > Data safety):**
- [ ] Personal info: Name, phone (delivery orders), email (staff accounts)
- [ ] Data encrypted in transit: Yes (HTTPS)
- [ ] Data encrypted at rest: Yes (PII encrypted with pgcrypto)
- [ ] Data deletion: Users can request deletion (via cafe admin)
- [ ] Data shared with third parties: No

---

## Part 5: Monitoring & Alerting

> Set up before real traffic. ~0.5 day.

### 5.1 Uptime Monitoring

- [ ] **Set up UptimeRobot** (free tier: 50 monitors, 5-min intervals)
  - Monitor 1: `https://app.gustri.com/api/health` — expect `status: ok` in response
  - Monitor 2: `https://order.gustri.com` — expect 200 status
  - Alert contacts: your email + phone (SMS)

### 5.2 Sentry Alert Rules

- [ ] **Staff-web project:**
  - Alert: > 10 errors in 5 minutes → email + Slack
  - Alert: new unhandled exception → email
  - Performance: p95 API route > 2s → email

- [ ] **Customer-web project:**
  - Alert: > 5 errors in 5 minutes → email (customer-facing, more sensitive)
  - Alert: new unhandled exception → email

- [ ] **Mobile project:**
  - Alert: new crash → email
  - Alert: > 3 crashes in 1 hour → email + phone

### 5.3 Supabase Monitoring

- [ ] **Dashboard > Reports** — check daily
  - API requests, database connections, storage usage, realtime connections
  - Set up usage alerts if available on your plan

- [ ] **Database monitoring** (from SCALE-26)
  - Periodically run: `curl -H "Authorization: Bearer $TOKEN" https://app.gustri.com/api/v1/admin/db-stats`
  - Watch for: slow queries > 1s, connection count > 40

---

## Part 6: Soft Launch

> 1-2 cafes for 1 week before scaling. This is critical — do NOT skip.

### 6.1 Onboard First Cafe

- [ ] **Create tenant** via Supabase Dashboard or SQL:
  ```sql
  INSERT INTO tenants (name, slug, plan) VALUES ('Cafe Name', 'cafe-name', 'pro');
  ```
- [ ] **Create admin user** via the staff management API or script
- [ ] **Configure cafe settings** (currency, tax, branding, delivery toggle)
- [ ] **Set up menu** (categories + items with photos)
- [ ] **Set up tables** (create table records, print QR codes)
- [ ] **Train staff** on the staff-web dashboard and mobile app

### 6.2 Monitor First Week

- [ ] Check Sentry daily for errors
- [ ] Check `/api/health` response
- [ ] Check Supabase Dashboard for connection counts and API usage
- [ ] Ask staff for feedback on pain points
- [ ] Watch for:
  - Realtime disconnections (check notification-provider fallback)
  - Slow page loads (check React Query cache hits)
  - Payment workflow confusion
  - QR code scanning issues on different phones

### 6.3 Fix Issues Found

- [ ] Create a GitHub issue for each problem found
- [ ] Fix critical issues immediately
- [ ] Batch non-critical fixes for a weekly release

---

## Part 7: Payment Gateway Integration

> Only needed if you want in-app card payments. If cafes use external card terminals, skip this.
> Effort: 3-5 days.

### 7.1 Choose Provider

| Provider | Best for | Fees | Integration |
|----------|----------|------|-------------|
| **iyzico** | Turkey | 2.49% + ₺0.29 | REST API, well-documented |
| **PayTR** | Turkey | Negotiable | REST API |
| **Stripe** | International | 2.9% + $0.30 | SDK, best DX |

Recommendation for Turkey: **iyzico** (most established, Supabase-friendly).

### 7.2 Integration Plan

- [ ] Create payment service module
- [ ] Add card payment form to order detail page
- [ ] Handle webhooks for payment confirmation
- [ ] Update order status on successful payment
- [ ] Add refund API integration
- [ ] Test with iyzico sandbox environment

### 7.3 PCI Compliance

- [ ] NEVER store raw card numbers — let the payment provider handle tokenization
- [ ] Use the provider's hosted payment page or SDK (client-side tokenization)
- [ ] Document that card processing is handled by the gateway, not your app
- [ ] Add PCI compliance statement to privacy policy

---

## Part 8: Email Notifications

> Nice-to-have for launch. Realtime + push cover the critical path.
> Effort: 1-2 days.

### 8.1 Choose Email Service

| Service | Free tier | Best for |
|---------|-----------|----------|
| **Resend** | 3,000 emails/month | Modern API, React Email templates |
| **SendGrid** | 100 emails/day | Enterprise, high volume |
| **Supabase Auth** | Built-in | Auth emails only |

Recommendation: **Resend** (simplest integration, good free tier).

### 8.2 Email Types to Implement

- [ ] **Order confirmation** — sent to delivery customers after order placed
- [ ] **Delivery status update** — "Your order is out for delivery"
- [ ] **Daily summary** — end-of-day report emailed to cafe owner
- [ ] **Staff account created** — welcome email with login credentials

### 8.3 Implementation

- [ ] Set up Resend account + API key
- [ ] Create email templates (React Email or HTML)
- [ ] Create Supabase Edge Function or API route for sending
- [ ] Trigger emails from relevant database webhooks or API routes

---

## Part 9: Scale to 100 Cafes

> After soft launch proves stable. Ongoing.

### 9.1 Tenant Onboarding Process

- [ ] Create a self-service signup flow (marketing site → create tenant → create admin)
- [ ] Or: manual onboarding via admin panel
- [ ] Automate: tenant creation, admin user, default menu template, QR code generation

### 9.2 Capacity Planning

- [ ] At 50 cafes: evaluate Supabase connection usage, consider Team plan
- [ ] At 100 cafes: evaluate if you need a dedicated Supabase instance
- [ ] Monitor: `pg_stat_activity` connection counts, `pg_stat_statements` slow queries
- [ ] Consider table partitioning for orders table when it hits ~2M rows

### 9.3 Operational Runbook

- [ ] Document: how to onboard a new cafe
- [ ] Document: how to handle a cafe leaving (data export, tenant deactivation)
- [ ] Document: how to rollback a bad deployment (Vercel instant rollback)
- [ ] Document: how to rollback a bad migration
- [ ] Document: how to restore from PITR backup
- [ ] Document: on-call procedures (who gets paged, escalation path)

---

## Timeline Summary

```
Day 1-2:  Part 1 (infrastructure) + Part 2 (legal pages)
Day 3:    Part 3 (web deployment) + Part 5 (monitoring)
Day 3-4:  Part 4.1-4.3 (store accounts + metadata) — in parallel with web launch
Day 5:    Part 4.4-4.5 (screenshots + app config fixes)
Day 6:    Part 4.6 (submit to TestFlight + internal testing)
Day 7-14: Part 6 (soft launch with 1-2 cafes)
Day 14:   Part 4.6 (submit to stores for review)
Day 15-21: Store review period + fix any issues
Day 21+:  Public launch + Part 7/8 (payments, email) if needed
```

**Total to web launch: ~3 days**
**Total to store submission: ~6 days**
**Total to public launch: ~3 weeks (including soft launch)**
