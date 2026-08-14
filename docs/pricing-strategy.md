# Gustri - Pricing Strategy

## Target Market

Small to medium cafes and restaurants in Azerbaijan and CIS region.

---

## Competitor Analysis

| System | Region | Free Tier? | Entry Price | Mid Tier | Restaurant Tier |
|--------|--------|-----------|-------------|----------|-----------------|
| **Loyverse** | Global | Yes (generous) | $0 | $5-27/mo add-ons | N/A |
| **Square** | Global (US-focused) | Yes | $0 | $49/mo | $149/mo |
| **Poster POS** | CIS/Global | 15-day trial | $26/mo | $44/mo | $62/mo |
| **iiko** | CIS/Azerbaijan | No | ~$16/mo | ~$49/mo | ~$86/mo |
| **Toast** | USA only | Yes (high fees) | $0 | $69/mo | Custom |
| **Clopos** | Azerbaijan/Turkey | No | $59/mo | $99/mo | $149/mo |
| **Smaregi** | Japan | Yes (1 store) | $0 | $59/mo | $103/mo |
| **R-Keeper** | CIS/Enterprise | No | ~$81/mo | ~$121/mo | ~$168/mo |
| **Lightspeed** | Global | No | $69/mo | $189/mo | $399/mo |

### Key Regional Competitors

- **iiko** — Dominates Azerbaijan (official partner: Optima Group), starts ~$16/mo
- **Clopos** — Local Azerbaijan/Turkey competitor, starts $59/mo, no free tier
- **Poster POS** — Budget CIS leader, $26-62/mo
- **No competitor offers a generous free tier** in Azerbaijan/CIS

---

## Pricing Models in the Industry

| Model | Used By | Pros | Cons |
|-------|---------|------|------|
| Freemium + Add-ons | Loyverse, Square | High adoption, low barrier | Hard to monetize small users |
| Pure SaaS tiers | Poster, iiko, Clopos | Predictable revenue | Higher barrier to entry |
| Free + Transaction fees | Square, Toast (US) | "Free" attracts users | Not applicable in CIS (separate payment processors) |
| Per-location + per-terminal | Most systems | Scales with business | Can feel expensive for multi-device setups |

---

## Recommended Plan Structure

| Plan | Price | Target |
|------|-------|--------|
| **Free** | $0/mo | Solo cafes, food trucks, trying out |
| **Standard** | $19-29/mo | Small cafes (1-2 staff) |
| **Pro** | $49-69/mo | Medium cafes with full operations |
| **Business** | $99-129/mo | Multi-location, advanced needs |

---

## Feature Distribution by Plan

**This table reflects what is actually enforced** by `plan_limits()` (SQL) and
`@gustri/core` `PLAN_LIMITS` (kept in sync by a CI parity test). Update both when
changing a cap. Do not list a feature as tier-gated here unless it is enforced.

| Feature | Free | Standard | Pro | Business |
|---------|------|----------|-----|----------|
| **Orders / month** | **500** | Unlimited | Unlimited | Unlimited |
| **Tables** | **5** | **15** | **40** | Unlimited |
| Menu items | Unlimited | Unlimited | Unlimited | Unlimited |
| **QR ordering** | **Yes** | Yes | Yes | Yes |
| Kitchen display (mobile) | Yes | Yes | Yes | Yes |
| Takeout & delivery orders | Yes | Yes | Yes | Yes |
| Split payments · waiter calls | Yes | Yes | Yes | Yes |
| Customer feedback | Yes | Yes | Yes | Yes |
| Expense tracking | Yes | Yes | Yes | Yes |
| Stock / inventory | — | — | **Yes** | Yes |
| Waste logging | — | — | **Yes** | Yes |
| Staff scheduling | — | — | **Yes** | Yes |
| Task management | — | — | **Yes** | Yes |
| Custom branding (hide "Powered by gustri") | — | **Yes** | Yes | Yes |
| Analytics | Basic (today only) | Full | Full | Full |
| Support | Community | Email | Priority email | Phone + email |

**Free-tier note:** QR ordering is intentionally ON for Free, but custom
branding is OFF — so a free tenant's QR menu shows "Powered by gustri", turning
every customer scan into free marketing. Free's only hard cap is 500 orders/mo
and 5 tables; paid tiers have **no order cap** (a mid-service POS lockout would
be catastrophic — they scale on tables + features instead).

### 🚧 Planned — not yet built (do NOT sell as available)

These appear in earlier marketing copy but are **not implemented or enforced**.
Keep them off the live pricing page (or clearly labelled "coming soon") until shipped:

| Feature | Intended tier |
|---------|---------------|
| Loyalty / points | Pro+ |
| Multi-location | Business |
| API access | Business |
| Multi-language menu | All (DB currently single `name`/`description` per item) |

---

## Additional Revenue Streams

| Add-on | Price |
|--------|-------|
| Extra terminal | $9-15/mo per terminal |
| SMS/WhatsApp marketing | $15-25/mo |
| Custom domain / white-label customer app | $19/mo |
| Annual billing discount | 20% off monthly price |
| Onboarding/setup fee (one-time) | $50-100 |

---

## Why This Strategy Works

### 1. Free Tier Advantage
No competitor in Azerbaijan/CIS offers a generous free tier. Including QR ordering, table management (up to 5 tables), and mobile kitchen display for free will drive adoption and word-of-mouth.

### 2. Undercuts Competition
Standard plan at $19-29/mo is cheaper than Clopos ($59), Poster ($26), and iiko ($49) while offering more built-in features.

### 3. Built-in Features vs Add-ons
Competitors charge extra for delivery, scheduling, expenses. Gustri includes these across all plans, making total cost of ownership lower.

### 4. Regional Price Sensitivity
CIS/Turkey cafes budget $30-100/month for POS. Our pricing fits comfortably within this range while offering room for upsell.

---

## What Drives Upgrades (In Order of Importance)

1. **Online ordering & delivery integration** (Wolt, Glovo)
2. **Table management + QR ordering**
3. **Kitchen display** (mobile app)
4. **Inventory tracking** (reducing waste = direct cost savings)
5. **Employee scheduling**
6. **Loyalty/CRM** (repeat visits)
7. **Advanced analytics**

---

## Competitive Advantages of Gustri

| Feature | Gustri | Others |
|---------|-----------|--------|
| Built-in delivery with driver assignment | Yes | Via 3rd party (iiko, Clopos) |
| Waiter call system | Yes | Not common |
| Customer feedback system | Yes | Not built-in |
| Inventory + waste tracking | Yes | Usually add-on |
| Task management for staff | Yes | Not common |
| White-label branding | Yes (Standard+) | Premium only |
| Free/self-hosted option | Yes | No (all competitors charge) |

---

## Features to Add (Based on Competitor Analysis)

### High Priority
1. **Reservation system** — table booking with time slots
2. **Customer database/CRM** — track returning customers
3. **Loyalty/points program** — encourage repeat visits
4. **E-Kassa integration** — legal requirement in Azerbaijan

### Medium Priority
5. **Multi-language menu** — multilingual name/description fields for menu items and categories (az, ru, tr, en)
6. **Receipt/thermal printer integration**
7. **Advanced analytics** — trends, comparisons, charts
8. **3rd party delivery integration** (Wolt, Glovo)
9. **Training mode** — staff onboarding

### Lower Priority
10. **Self-checkout/kiosk mode**
11. **Multi-store management dashboard**
12. **Purchase order management** (supplier ordering)
13. **E-commerce module**

---

## Important: Legal Compliance

Before launching in Azerbaijan, **E-Kassa** (electronic cash register) integration is a legal requirement. Both iiko and Clopos support this. This must be implemented before commercial launch.

---

## Pricing Comparison Summary

At each price point, Gustri offers more value than competitors:

| Price Range | Gustri | Competitor |
|-------------|-----------|------------|
| $0/mo | Free (5 tables, QR, mobile kitchen display) | Loyverse Free (no restaurant focus) |
| $19-29/mo | Standard (delivery, payments, 200 items) | Poster Mini $26 (100 items, no delivery) |
| $49-69/mo | Pro (full history, loyalty, unlimited items) | iiko Pro $86 (similar but more expensive) |
| $99-129/mo | Business (multi-location, API, unlimited) | Clopos Pro $149, R-Keeper $168+ |
