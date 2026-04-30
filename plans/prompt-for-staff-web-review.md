You are a senior security engineer, frontend architect, and systems reliability expert.

Audit the staff dashboard web app of a restaurant management system.

## Context

App: staff-web (Next.js 14, App Router)

Purpose:
- Internal dashboard used by restaurant staff
- Roles: admin, owner, waiter, kitchen
- High-privilege operations:
  - order management
  - payments & refunds
  - inventory & expenses
  - staff management
  - analytics & reports

Backend:
- Supabase (Postgres + RLS + Realtime)
- No trusted backend layer (client talks directly to DB)

Shared layers:
- @gustri/api-client
- @gustri/queries
- @gustri/core

Assume:
- Staff accounts can be compromised
- Malicious insider is possible
- Client code is modifiable (devtools, scripts)
- Requests can be forged outside UI

---

## Your goals

### 1. Authorization & role safety (CRITICAL)

Analyze role-based access:

- Are admin/owner/waiter/kitchen permissions enforced in DB or only UI?
- Can a waiter escalate privileges via API calls?
- Are sensitive operations protected?

Check:
- refunds
- payments
- expense creation
- stock changes
- staff management

Ask:
- Can a low-privilege user perform high-privilege actions by bypassing UI?

---

### 2. Financial integrity

This system handles money → high risk.

Analyze:

- Can payments be:
  - faked?
  - duplicated?
  - modified after creation?

- Can refunds be abused?
- Are totals calculated safely (server-side)?
- Are race conditions possible?

Check:
- split payments
- partial payments
- tips
- refunds

---

### 3. Data exposure

Check if staff can see:

- other tenants’ data
- sensitive staff info
- customer PII beyond necessity

Analyze:
- queries returning excessive fields
- missing filtering

---

### 4. State consistency & race conditions

Critical for real-time system.

Check:

- Multiple staff editing same order
- Payment + order closing conflicts
- Table transfers during active orders

Ask:
- Can two users overwrite each other?
- Can order reach invalid state?

---

### 5. Realtime behavior

Analyze:

- Supabase subscriptions:
  - scope (tenant, table, orders)
  - duplication
  - leaks

Check:
- over-subscription
- stale data
- missed updates

---

### 6. Performance

Focus on real-world usage:

- busy restaurant (many orders per minute)

Check:

- dashboard queries (heavy?)
- unnecessary refetches
- React rendering inefficiencies
- large tables/lists

---

### 7. UX risks that cause bugs

Identify:

- double-click / duplicate actions
- missing loading states
- optimistic updates without rollback

---

### 8. Coupling with backend

Analyze:

- does UI assume DB behavior?
- fragile coupling to schema?
- hardcoded enums / states?

---

## REQUIRED: Attack scenarios

Provide at least 5 realistic insider or compromised-account attacks.

Example:

1. Attack name
2. Steps
3. Why it works
4. Impact
5. Fix

---

## REQUIRED: Output format

### 🔴 Critical vulnerabilities
- Issue
- Attack scenario
- Impact
- Fix

---

### 🟠 High-risk issues

---

### 🟡 Medium issues

---

### 🟢 Low issues

---

### 🧨 Top 5 exploit scenarios

---

### 🛠 Recommended fixes
(practical, code-level if possible)

---

### 🚀 Performance improvements

---

### 🧱 Structural weaknesses

---

### 🧪 Consistency & race condition risks

---

### ✅ What is well designed
(do not skip this)

---

## Input you will receive

- staff-web pages/components
- queries/hooks used
- api-client usage
- relevant DB assumptions

If something is missing:
Explicitly say what cannot be verified.

---

## Important rules

- Assume client is untrusted
- Do NOT trust UI-based permissions
- Focus on DB-enforced rules
- Prioritize financial and privilege risks
- Be specific to this system