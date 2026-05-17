# customer-web Production-Readiness Audit — Phased Plan

Source audit: deep production-grade review (Opus session, May 2026). The audit
covered UX, architecture, performance, security, realtime behavior, multi-tenant
safety, mobile usability, conversion, and accessibility for the customer-facing
QR + delivery flows.

Predecessor work — close enough that the previous fixes are part of context:

- [17-CUSTOMER-WEB-AUDIT-FIX-PLAN.md](17-CUSTOMER-WEB-AUDIT-FIX-PLAN.md) (PRs #97–#102)
- [18-CUSTOMER-WEB-AUDIT-CONTINUATION.md](18-CUSTOMER-WEB-AUDIT-CONTINUATION.md) (M1, M2, M5, M6, qr-tokens resolve)

What this round adds: the bar moved from "no obvious security holes" to
"production-grade for real restaurants on flaky phones." Findings are
operational, conversion-sensitive, and mobile-first.

---

## How to use this set

1. **Phase order is blast-radius, not difficulty.** Phase 1 blocks release.
   Phases 2–6 ship behind a planned release in roughly that order, but items
   within a phase can parallelize.
2. **Each phase file** has the same shape as `17-…-FIX-PLAN.md`: every item
   has *Where / What / Why / Fix steps / Verification / Done when*, with a
   leading `[ ]` checkbox. Tick when shipped to `main` and write the PR
   number next to the box.
3. **Status legend.** `[ ]` not started · `[~]` in progress · `[x]` shipped ·
   `[-]` won't fix (justify inline).
4. **`[DB]` tag** = needs a migration + regenerated types (`pnpm db:types:generate`)
   committed in the same PR.
5. **Don't re-litigate audit findings here.** If you need the *why this matters*
   for a real restaurant, look at the original audit transcript. These plans
   are the *what to change*.

---

## Phase index

| Phase | Title | File | Why it's gated where it is |
|---|---|---|---|
| 1 | Critical release blockers | [22-CW-PROD-PHASE-1-CRITICAL.md](22-CW-PROD-PHASE-1-CRITICAL.md) | Duplicate orders, route bypass, i18n breakage shipping to every customer |
| 2 | High-risk operational | [23-CW-PROD-PHASE-2-HIGH.md](23-CW-PROD-PHASE-2-HIGH.md) | Stale realtime + multi-tenant settings cache + cancel-race feedback |
| 3 | Major customer UX | [24-CW-PROD-PHASE-3-MAJOR-UX.md](24-CW-PROD-PHASE-3-MAJOR-UX.md) | Conversion + trust during checkout, ordering, and tracking |
| 4 | Security & privacy | [25-CW-PROD-PHASE-4-SECURITY.md](25-CW-PROD-PHASE-4-SECURITY.md) | PII residue on shared devices, bearer-token cleanup, error-mapping integrity |
| 5 | Mobile usability & accessibility | [26-CW-PROD-PHASE-5-MOBILE-A11Y.md](26-CW-PROD-PHASE-5-MOBILE-A11Y.md) | Touch targets, RTL, focus traps, iOS Safari `h-screen`, picker scroll |
| 6 | Performance & polish | [27-CW-PROD-PHASE-6-PERFORMANCE.md](27-CW-PROD-PHASE-6-PERFORMANCE.md) | Realtime debouncing, fetch throttle tuning, render-cost cleanups |

---

## Top-10 customer failure scenarios (single-page reference)

Pulled from the audit so the next reviewer can scan without re-reading.

1. Double-order on flaky wifi (dine-in) → Phase 1 C1
2. Duplicate waiter calls during noisy table → Phase 1 C2
3. QR token rotated mid-meal → Phase 2 H4
4. Tab killed mid-checkout, cart lost → Phase 3 M4
5. Phone sleeps, order tracking stale → Phase 2 H1/H2
6. Two customers at same table, first tab still open → already closed by
   #102 (`id=eq.${orderId}` filter); Phase 3 M5 closes the cosmetic echo
7. Delivery customer clears URL — loses access token → Phase 4 S3
8. Currency `$` flickers before settings load → Phase 6 P4
9. RTL customer sees flipped FAB and back arrow → Phase 5 A2
10. Customer cancels item, kitchen ignores, bill includes it → Phase 1 C3

---

## What this round explicitly does NOT include

- **Server-side rate-limit changes** on `/api/v1/customer/*` — Upstash budgets
  are tuned and Phase 1 C3 only re-routes one missing path through them.
- **New translations beyond the i18n gaps already flagged** (Phase 1 C4/C5
  and Phase 6 P9). The 20-locale coverage rule still applies for any new key.
- **Payment / receipt flows** — not yet in customer-web; Phase 3 M6/M7 stops
  short of building one.
- **Marketing-site / staff-web changes** — except where customer-web crosses
  into a `/api/v1/customer/*` route boundary (Phase 1 C3, Phase 4 S5).

---

## Release-readiness checklist (Phase 7 stand-in)

Lives at the bottom of [27-CW-PROD-PHASE-6-PERFORMANCE.md](27-CW-PROD-PHASE-6-PERFORMANCE.md)
so it's the last thing the reviewer touches before tagging the release.

Covers: mobile testing, reconnect testing, realtime testing, low-end device
testing, translation testing, QR workflow testing, production resilience
synthetic tests.
