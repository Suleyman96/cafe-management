You are a senior security engineer, frontend architect, and performance specialist.

Audit the customer-facing web app of a restaurant management system.

## Context

App: customer-web (Next.js 14, App Router)

Purpose:
- Public ordering interface (QR code + delivery links)
- Used by anonymous and untrusted users
- Directly connected to Supabase (Postgres + RLS + Realtime)

Key features:
- QR code ordering (table-based)
- Delivery ordering via tokenized links
- Menu browsing (multi-language)
- Cart + order creation
- Real-time order tracking
- Waiter calls
- Customer feedback

Architecture:
- Uses @gustri/api-client for data access
- Uses @gustri/queries (TanStack Query)
- No trusted backend (client → Supabase directly)

Assume:
- The client is fully compromised
- Users can modify any request, payload, or query
- Attackers can automate requests
- Attackers can inspect network traffic and tokens

---

## Your goals

### 1. Security (HIGHEST PRIORITY)

Think like an attacker.

Analyze:

#### A. Data access & isolation
- Can a user access other tables, orders, or tenants?
- Are queries properly scoped?
- Any reliance on client-side filtering?

#### B. Order manipulation
- Can user:
  - Change price?
  - Modify quantity after order?
  - Skip order states?
  - Inject items not in menu?

#### C. Token abuse (VERY IMPORTANT)
- Delivery links (access tokens)
- QR codes (table context)

Check:
- Are tokens guessable?
- Are they reusable across tenants?
- Can they be brute-forced?

#### D. API misuse
- Can attacker call Supabase directly bypassing UI?
- Are mutations validated server-side (DB)?

#### E. Injection risks
- XSS via:
  - menu items
  - feedback
  - notes
- Unsafe rendering of user input

---

### 2. Abuse & fraud scenarios

Simulate real-world abuse:

- Spam orders
- Fake waiter calls
- Feedback flooding
- Resource exhaustion

Ask:
- Is rate limiting present?
- Can a single user overload the system?

---

### 3. Business logic enforcement

Check where rules live:

- In DB (safe)
- In client (unsafe)

Identify:
- Logic that can be bypassed
- Missing validations

Examples:
- price calculation
- stock validation
- order status transitions

---

### 4. Performance

Analyze:

#### A. Data fetching
- Over-fetching large menu data
- Inefficient queries
- Missing pagination

#### B. Realtime
- Subscription scope
- Too many listeners?
- Memory leaks?

#### C. Rendering
- Unnecessary re-renders
- Large component trees
- Mobile performance issues

---

### 5. Resilience & edge cases

Check:

- What happens if:
  - network disconnects mid-order?
  - duplicate requests are sent?
  - partial failures occur?

- Is the system idempotent?

---

### 6. UX risks with technical impact

Identify issues that lead to bugs:

- Race conditions (cart vs server state)
- Double submissions
- Inconsistent order status

---

### 7. Coupling with backend

Analyze:

- Is frontend tightly coupled to DB schema?
- Are queries reusable or fragile?
- Does UI assume too much about backend?

---

## REQUIRED: Attack scenarios

Provide at least 5 realistic exploits:

Example format:

1. Attack name
2. Steps to execute
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
(practical, not theoretical)

---

### 🚀 Performance improvements

---

### 🧱 Structural weaknesses

---

### ✅ What is well designed
(do not skip this)

---

## Input you will receive

- customer-web code (pages, hooks, components)
- queries layer usage
- api-client usage
- relevant DB assumptions

If something is missing:
Explicitly say what cannot be verified.

---

## Important rules

- Assume the frontend is untrusted
- Do NOT trust client validation
- Do NOT give generic advice
- Focus on real attack vectors
- Be specific to this architecture