# Gustri Marketing Site — Production-Grade Audit

> Generated: 2026-05-20
> Scope: `apps/marketing/` (Next.js 14, 10 routes, public-facing site)
> Audience: founders, marketing, frontend
> Status: planning input — not yet a tracked work plan

---

## TL;DR

The codebase is healthy. The marketing strategy is the weak link. A first-time visitor cannot tell within 10 seconds: **who this is for, why it's cheaper, or what specific operational pain it removes.**

Site is technically lean and clean (10 routes, no images, no animation bloat, strict CSP, well-structured Tailwind). The fix is messaging, social proof, and IA — not a rebuild.

**Five highest-leverage fixes (do this week):**

1. Fix the broken `Sign in` → `/pricing` link in [header.tsx:80-93](../apps/marketing/src/components/layout/header.tsx#L80-L93). Should point to staff-web login. 5 minutes.
2. Rewrite the hero (small-cafe focus, money saved, control from anywhere). 1 hour.
3. Cut signup form to 2 fields (email + password). 30 minutes.
4. Add Plausible or PostHog analytics. 1 hour.
5. Add product screenshots to hero and 2-3 feature sections. 4 hours.

---

## 🚨 Critical marketing problems

Must fix before any meaningful traffic push.

### 1. The hero answers the wrong question

[hero.tsx:21-29](../apps/marketing/src/components/home/hero.tsx#L21-L29) says:

> "Your restaurant, one platform. POS, QR ordering, kitchen display, delivery, inventory, and staff scheduling — all in one place. Start free, scale as you grow."

This is a **feature inventory disguised as a headline**. It says what Gustri *is*, not who it's for or what it *does for them*. A small cafe owner sees "POS, KDS, delivery, inventory…" and pattern-matches it to enterprise software they assume is expensive and complicated — the exact perception you need to break.

**Fix direction:** Hero must answer "who" + "what painful thing goes away" within 4 seconds. See [Recommended homepage structure](#-recommended-homepage-structure).

### 2. The emotional anchor is completely missing

The stated core emotional message — *"Your cafe stays under control even when you are not there"* — appears **zero times** anywhere in the marketing site. Not the hero, not the features, not the CTA section. This is the single most powerful conversion lever for small cafe owners (most of whom also work day jobs, manage multiple sites, or take days off and worry). Build the whole site around this.

### 3. Header CTAs are inconsistent and partly broken

[header.tsx:80-93](../apps/marketing/src/components/layout/header.tsx#L80-L93):

- **"Sign in" → `/pricing`** — this is a bug. Returning users clicking "Sign in" should hit the staff-web login, not the pricing page. It will confuse and frustrate existing customers.
- **"Start Free" → `/pricing`** — but the hero's "Start Free" goes to `/signup` directly ([hero.tsx:35-39](../apps/marketing/src/components/home/hero.tsx#L35-L39)). Same label, different destinations. Pick one funnel.

### 4. Zero social proof anywhere

No testimonials, no customer logos, no "X cafes in Baku trust Gustri", no founder face, no demo video, no product screenshots ([apps/marketing/public/](../apps/marketing/public/) doesn't even exist). For a 2025/2026 SaaS asking restaurants to put their daily operations on your platform, this is a trust-killing absence. Small cafe owners are *less* tolerant of "anonymous SaaS" than enterprise buyers, not more.

### 5. No product screenshots — visitors cannot see what they're buying

Restaurant software is bought visually. Owners want to see "is this what my waiter will tap on for 8 hours a day?" Right now, the site is text + lucide icons. Add real screenshots of: POS order screen, kitchen display, QR customer menu, mobile app on a phone, dashboard.

### 6. Affordability is claimed but never proven

$10/$25/$70 is shown but never *contextualized*. The blog post [free-pos-systems-for-restaurants.mdx](../apps/marketing/src/content/blog/free-pos-systems-for-restaurants.mdx) does the math beautifully ("$270/mo in Square fees alone") but **none of this math is on the homepage or pricing page**. The strongest affordability argument we have lives only where readers who already chose to click "Blog" will see it.

---

## 🔴 Major positioning/messaging issues

### Positioning reads enterprise-neutral, not small-cafe

The phrase "small cafe", "coffee shop", "bakery", "tea house" appears almost nowhere in primary copy. Pricing descriptions hint at it ("For very small cafes just getting started" — [pricing/page.tsx](../apps/marketing/src/app/pricing/page.tsx)) but the hero, features section, and bottom CTA are written generically for "restaurants." A Toast or Square visitor lands on this page and sees no reason this is *for them specifically*.

### "All-in-one" is a category claim, not a benefit

Every competitor claims all-in-one. The differentiator isn't *that* it's all-in-one — it's that **the all-in-one version is cheap, doesn't lock you into card processing, and works on the tablet you already own**. None of this surfaces.

### The free plan is described as a limitation, not a foothold

[pricing.tsx](../apps/marketing/src/components/home/pricing.tsx) presents Free as: "Up to 5 tables, up to 100 orders/month, basic analytics, community support." This frames it as "stripped down." Reframe: "Run a real cafe — POS, kitchen tickets, QR menus — without ever paying us a cent until you grow past 100 orders/month." Same limits, different psychology.

### No mention of "no card processor lock-in"

This is the strongest moat vs Toast/Square ([gustri-vs-iiko.mdx](../apps/marketing/src/content/blog/gustri-vs-iiko.mdx) and [free-pos-systems-for-restaurants.mdx](../apps/marketing/src/content/blog/free-pos-systems-for-restaurants.mdx) imply it). Surface it as a top-3 homepage section: *"Use any payment processor. We're software, not a payments company."*

### Multilingual support is buried and only mentioned in passing

[hero.tsx:49-51](../apps/marketing/src/components/home/hero.tsx#L49-L51): "Trusted by cafes and restaurants. 20 languages supported." For a product targeting Azerbaijan + emerging markets where staff often don't read English, **20-language staff UI is a huge differentiator** vs Toast/Square (English/Spanish only). It deserves a dedicated feature section, not a six-word footer.

---

## 🟠 High-impact conversion problems

### Signup form asks too much, too early

[signup/page.tsx](../apps/marketing/src/app/signup/page.tsx) collects: full name + restaurant name + email + password + confirm password. That's 5 fields before the cafe owner sees a single screen of the product. Cut to email + password (or email + magic link), collect restaurant name on first dashboard load. Every form field after the second costs ~7% conversion (industry benchmark).

### No demo flow at all

There is no `/demo` route, no embedded video, no interactive product tour. The "Contact Sales" CTA on the Business plan and bottom CTA bar is the *only* path to seeing the product without signing up. Many small cafe owners will not give an email until they see what they're buying. Add either:

- 30-second autoplay product video on hero
- An interactive demo (read-only dashboard with seeded data) at `/demo`
- A "Watch a 2-min tour" link beside "Start Free"

### Pricing page CTA copy is too generic

[pricing/page.tsx](../apps/marketing/src/app/pricing/page.tsx): "Start Free", "Get Started", "Get Started", "Contact Sales." The two "Get Started" CTAs (Standard + Pro) should be **"Try Pro free for 14 days"** or **"Start Free — Upgrade to Pro Anytime"** to reduce commitment anxiety.

### No "what happens next" reassurance near CTAs

After "Start Free" — what happens? Does it ask for a credit card? Will I be charged? Do I install anything? **None of this is answered next to the CTA.** Add microcopy under each Start Free button: *"No credit card. Setup takes 5 minutes. Free forever for ≤100 orders/month."*

### FAQ buried at the bottom answers questions that should be in the hero

[faq.tsx](../apps/marketing/src/components/home/faq.tsx) has "Is there really a free plan?" and "Do I need special hardware?" — these are the questions blocking conversion at the *hero* level. Pull the answers up into hero subcopy or a "How it works" strip.

### CTA section "Talk to Sales" is wrong for this market

[cta.tsx](../apps/marketing/src/components/home/cta.tsx) bottom CTA: "Talk to Sales." A small cafe owner doesn't want to talk to sales. They want to log in and try it. Change to **"Book a 15-min demo"** or remove entirely — the secondary CTA on this product should be "See it in action" (video/demo), not a sales call.

---

## 🟡 Medium UX/content issues

- **FAQ accordion only opens one item at a time** ([faq.tsx](../apps/marketing/src/components/home/faq.tsx)) — and the first item is force-opened. Let users open multiple. The current pattern hides content that helps conversion.
- **Features section is 12 cards in a flat grid** with no grouping ([features.tsx](../apps/marketing/src/components/home/features.tsx)). Group into 3 themes: *Run a shift*, *See what's happening*, *Save money*.
- **"Trusted by cafes and restaurants"** in the hero is unattributed and reads as filler ([hero.tsx:49-51](../apps/marketing/src/components/home/hero.tsx#L49-L51)). Either give a number ("Trusted by 200+ cafes") or remove until you have one.
- **Blog post cards** ([post-card.tsx](../apps/marketing/src/components/blog/post-card.tsx)) reference a `post.image` field but none of the existing posts populate it. Either remove the image branch or commission/generate post header images.
- **No "Last updated" or freshness signal** on blog posts — for SEO around "2026 guide" content this matters.
- **Contact page** ([contact/page.tsx](../apps/marketing/src/app/contact/page.tsx)) lists "Baku, Azerbaijan" but no map, no business hours, no expected response time. Add SLA-style reassurance: *"We reply to support within 4 hours, Mon–Fri."*
- **About page** doesn't include a founder photo or story. For small businesses buying from small businesses, the human face matters.

---

## 📱 Mobile UX problems

- **Hero blob gradients are 800×600px and absolute-positioned** ([hero.tsx:7-11](../apps/marketing/src/components/home/hero.tsx#L7-L11)). On small phones (<360px) these can cause layout overflow and unnecessary paint cost. Scale them down with breakpoint variants or hide on `<sm`.
- **Pricing grid forces 2 columns on `sm:`** ([pricing.tsx](../apps/marketing/src/components/home/pricing.tsx) `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`). On 640px tablets that means tiny pricing cards. Consider staying single-column until `md:`.
- **Sticky header takes ~64px** and the hero starts at `pt-32` — fine on desktop, but on mobile this leaves the hero headline below the fold on smaller phones. Tighten mobile top padding.
- **No "tap-to-call" or "tap-to-WhatsApp"** anywhere despite this being how small cafe owners actually contact vendors in the target market. Add `tel:` and `https://wa.me/` links on contact page and footer.
- **CTAs in mobile menu** ([header.tsx:106-130](../apps/marketing/src/components/layout/header.tsx#L106-L130)) only show "Start Free" — no "Sign in" for existing customers using their phone to access the dashboard. Add both.
- **No iOS install banner / "Add to Home Screen"** prompt — the marketing site itself could nudge existing customers to install the staff-web PWA.

---

## 🎨 Branding/design inconsistencies

- **Brand mark inconsistency**: SVG logo uses `primary-500` (#367B8B teal) but wordmark is lowercase "gustri" in plain `text-gray-900` — feels mismatched. Either commit to all-lowercase teal or tighten the lockup.
- **No defined heading scale or typography ramp** — Tailwind text sizes used ad-hoc. Define semantic tokens (`heading-1`, `heading-2`, `body-lg`) in [tailwind.config.ts](../apps/marketing/tailwind.config.ts) or in [@gustri/design-tokens](../packages/design-tokens/).
- **Two animations defined, neither used** ([tailwind.config.ts:39-52](../apps/marketing/tailwind.config.ts#L39-L52)) — `fade-in` and `slide-up` exist in config but aren't applied. Either use them on scroll-in for sections or delete the dead config.
- **Inter is the only font** — fine, but consider a slightly more distinctive display face for headlines to avoid "this looks like every SaaS landing page." A friendly geometric like Geist, Plus Jakarta Sans, or General Sans signals "modern + approachable" better than Inter alone.
- **Brand color (#367B8B teal) reads as muted/medical** — fine for trust, but it doesn't say "cafe / food / warm." Consider a secondary warm accent (terracotta, mustard) for CTAs to lift conversion and signal hospitality.

---

## 🧠 Information architecture problems

- **Features page exists but doesn't tell a story** — it's a longer feature grid. Should be organized by *use case* (Run the floor, Manage delivery, Control costs, See everything from your phone) rather than by feature category.
- **No `/qr-ordering`, `/kitchen-display`, `/mobile-app` dedicated landing pages** — each of these is a high-intent SEO query and a distinct buyer story. Right now a Google query like "QR ordering for cafe" lands on `/features` next to 11 other things.
- **No `/vs-toast`, `/vs-square`, `/vs-loyverse` comparison pages** — even though [the blog covers this](../apps/marketing/src/content/blog/free-pos-systems-for-restaurants.mdx). Comparison pages convert at ~3-5x blog post rates because the user is already at decision stage.
- **No `/for-cafes`, `/for-bakeries`, `/for-restaurants` segmentation** — the stated audience is segmented but the site treats them as one undifferentiated "restaurant" bucket.
- **Footer is sparse** ([footer.tsx](../apps/marketing/src/components/layout/footer.tsx)) — only Product/Company/Legal. Missing: Resources (blog, guides, help center), Solutions (by use case), Sub-processors, Status page, Sitemap link, Changelog.
- **No `/changelog` or `/whats-new`** — sends a "is this product still maintained?" signal to careful buyers.
- **No `/customers` or `/case-studies` page** — once we have even one cafe willing to be quoted, this is critical.

---

## 💰 Pricing & conversion weaknesses

### The pricing presentation

Current ([pricing/page.tsx](../apps/marketing/src/app/pricing/page.tsx)) is a four-tier card grid with terse bullet lists. Specific issues:

1. **"Up to 5 tables / 100 orders/month" framed as limit, not foothold** — see positioning section above.
2. **No annual pricing toggle** — for SaaS, ~30% of revenue typically comes from annual plans at 15-20% discount. We're leaving margin on the table.
3. **No "vs competitor at this volume" comparison** — pricing page should anchor against what Toast/Square would charge in fees for the same monthly order volume.
4. **No usage-based hints** — "What happens if I exceed 100 orders?" isn't answered next to the Free plan. Some owners won't sign up because they fear surprise bills.
5. **Business plan ($70) gates "Multi-location" and "API access"** — but a small chain of 3 cafes might want multi-location at Pro tier. Reconsider gating.
6. **No "Money back if you don't save 5h/week" or similar guarantee** — risk reversal is missing entirely.
7. **Stripe / payment partner logos not shown** — buyers wonder "how do they take my money? Is it secure?"

### The signup flow

- **Too many fields** (5 — should be 2).
- **No "what you'll get in the next 2 minutes" reassurance** on the signup page.
- **No onboarding preview** — no screenshots of "this is what your dashboard will look like in 5 min."
- **No email-only / magic link option** — passwords are friction.
- **No SSO** (Google sign-in) — every percent of signup conversion matters.
- **Plan param `?plan=X`** ([signup/page.tsx](../apps/marketing/src/app/signup/page.tsx)) is stored but never displayed back to the user. They should see *"You picked the Pro plan — start free, you'll be billed when you upgrade"* as a header on the signup form.

### Free plan messaging

Reframe the entire Free plan section around: **"Run your cafe entirely free if you do under 100 orders/month. Forever. No credit card. No expiration."** That sentence alone is more compelling than the current bullet list.

---

## 🔍 SEO/content strategy gaps

### Technical SEO

- ✅ Sitemap, robots, OG/Twitter present.
- ❌ **No JSON-LD structured data** at all. Add `Organization`, `SoftwareApplication`, `FAQPage` (homepage FAQ qualifies), `BreadcrumbList`, `Article` (blog), `Product` (pricing).
- ❌ **No `og:image`** in [layout.tsx:10-34](../apps/marketing/src/app/layout.tsx#L10-L34). Every social share renders as plain text. Generate one per route via `opengraph-image.tsx` (Next.js 14 supports this).
- ❌ **No `hreflang`** because the site isn't internationalized (see next point).
- ❌ **No canonical URLs explicitly set** — Next.js defaults are usually right, but verify for blog pagination and query-param signup pages.
- ❌ **Blog frontmatter has `image`** but it's not used in OG metadata for blog posts.

### Content strategy

- **5 blog posts is undersized** for a product targeting SEO-driven acquisition. The two competitor comparison posts ([gustri-vs-iiko.mdx](../apps/marketing/src/content/blog/gustri-vs-iiko.mdx), [free-pos-systems-for-restaurants.mdx](../apps/marketing/src/content/blog/free-pos-systems-for-restaurants.mdx)) are the highest-value pages — they should be promoted to first-class pages with dedicated UX, not buried in `/blog`.
- **No localized SEO** — we target Azerbaijan/CIS but content is English-only. At minimum: Russian (ru), Turkish (tr), Azerbaijani (az) blog content and meta — these are real search markets where "Toast" doesn't appear in results.
- **No location pages** — "POS for cafes in Baku", "Restaurant management software in Istanbul" etc.
- **No "ultimate guides"** pillar content — only listicles.

### Recommended content pillars

1. **Versus competitors**: `/vs-toast`, `/vs-square`, `/vs-loyverse`, `/vs-iiko`, `/vs-poster`, `/vs-r-keeper` (each a real page, not a blog post)
2. **Use cases**: "Restaurant management for [cafes / coffee shops / bakeries / tea houses / bistros]"
3. **Operational guides**: "How to reduce food waste in a cafe", "QR menu setup checklist", "How to manage a cafe remotely"
4. **Localized**: Region-targeted pages in RU/TR/AZ/UZ
5. **Calculators / interactive**: "How much would Toast cost you at $X/mo in card sales?" — practically writes itself from the existing blog math

---

## ⚡ Frontend/performance issues

The codebase is in good shape — the issues are minor:

- **Font loading**: [layout.tsx](../apps/marketing/src/app/layout.tsx) — verify Inter is loaded via `next/font` (subset, swap) not Google Fonts CDN. If not, fix.
- **CSP is strict but uses `'unsafe-inline'`** for scripts ([next.config.js](../apps/marketing/next.config.js)) — required by Next.js currently, but worth a TODO when migrating to Next 15+ with nonce support.
- **No image optimization config** because no images — but the moment we add screenshots, configure `images.formats: ['image/avif', 'image/webp']` and `next/image` everywhere.
- **`'use client'` on the entire signup page** ([signup/page.tsx](../apps/marketing/src/app/signup/page.tsx)) — extract the form into a child client component and keep the page wrapper as a server component for better metadata + faster TTFB.
- **No analytics** observable in the codebase (no Plausible, Vercel Analytics, PostHog, GA). We cannot iterate on conversion without measuring it. Add Plausible (privacy-friendly, fits CSP, small) or PostHog (event funnels).
- **No A/B testing tooling** — add when ready to iterate on hero variants.
- **No Sentry on marketing site** — at least catch JS errors in production.
- **No `<link rel="preconnect">`** to Supabase auth domain — small latency win on signup page.
- **`reading-time` runs at request time on `/blog`** — fine at small scale, but precompute and cache via `generateStaticParams` for blog posts.

---

## 🏆 Strongest product differentiators

These are what we should be selling, in priority order:

1. **Truly free for tiny cafes** — Not a 14-day trial. Not "free with hardware purchase." Free, forever, for ≤100 orders/month. Toast and Square cannot honestly say this. **This is the #1 hook.**

2. **No payment processor lock-in** — Toast forces 2.99% + 15¢, Square forces 2.6% + 10¢. We don't. For a cafe doing $10K/mo card volume, that's $250-300/mo difference. Lead with this math.

3. **20-language staff UI** — Toast/Square don't have this. Real moat in CIS, MENA, SE Asia. A waiter in Baku who only speaks Azerbaijani can run our POS. None of our competitors can say that.

4. **Mobile-first staff app** — Most competitors have web-only or weak mobile. Ours is React Native + Expo, real native UX. Owners who manage from their phone (our *core* persona) get a real app, not a responsive site.

5. **All-in-one without the all-in-one price** — POS + KDS + QR + inventory + delivery + staff scheduling at $10-25/mo. Toast's equivalent stack is $165+/mo + 2.99% fees.

6. **Realtime, modern stack** — Supabase + RN + Next.js means orders appear on the KDS instantly. Competitors built on older stacks have visible polling lag. *(Don't say "Supabase" — say "orders appear on the kitchen screen the moment they're taken.")*

7. **Setup in minutes, no hardware mandate** — Works on any tablet you already own. No proprietary terminal, no minimum 2-year contract.

8. **Multi-tenant from day one, owner can manage remotely** — Our stated core emotional message. Lean into it.

---

## 🧱 Recommended complete page structure

### Top-level navigation

```
Logo  |  Product ▾  |  Solutions ▾  |  Pricing  |  Resources ▾  |  [Sign in]  [Start Free]
```

**Product ▾**

- Point of Sale
- QR Ordering
- Kitchen Display
- Mobile App
- Delivery Management
- Inventory & Waste
- All Features →

**Solutions ▾** (segment landing pages)

- For Cafes
- For Coffee Shops
- For Bakeries
- For Tea Houses
- For Small Restaurants
- For Delivery-Only Kitchens

**Resources ▾**

- Blog
- Customer Stories
- Help Center *(future)*
- Pricing Calculator
- Versus Toast / Square / Loyverse / iiko
- Changelog

### Full site map

| Route | Purpose |
|---|---|
| `/` | Homepage |
| `/product/pos` | POS deep dive |
| `/product/qr-ordering` | QR ordering deep dive |
| `/product/kitchen-display` | KDS deep dive |
| `/product/mobile-app` | Mobile staff app deep dive |
| `/product/inventory` | Inventory + waste tracking |
| `/product/delivery` | Delivery management |
| `/features` | All features index |
| `/solutions/cafes` | Segment-specific landing |
| `/solutions/coffee-shops` | … |
| `/solutions/bakeries` | … |
| `/solutions/tea-houses` | … |
| `/solutions/small-restaurants` | … |
| `/pricing` | Pricing |
| `/pricing/calculator` | "How much you'd save vs Toast" calculator |
| `/vs/toast` | Comparison |
| `/vs/square` | Comparison |
| `/vs/loyverse` | Comparison |
| `/vs/iiko` | Comparison |
| `/demo` | Interactive demo / video |
| `/customers` | Logo wall + case studies |
| `/customers/[slug]` | Individual case study |
| `/blog` | Blog index |
| `/blog/[slug]` | Blog post |
| `/changelog` | Product updates |
| `/security` | Security page (RLS, encryption, sub-processors) |
| `/about` | About + team |
| `/contact` | Contact |
| `/help` | Help center *(future, link to docs subdomain)* |
| `/signup` | Signup (2-field, minimal) |
| `/privacy`, `/terms`, `/dpa`, `/sub-processors` | Legal |

---

## 🪄 Recommended homepage structure

Order matters. Each section answers one objection.

### Section 1 — Hero (above the fold)

**Headline:** *Run your cafe from your phone — and stop paying for software that's built for chains.*

(Variant to A/B: *Your cafe stays under control even when you're not there.*)

**Subhead:** *Gustri is the affordable, modern restaurant platform for small cafes, coffee shops, and bakeries. POS, QR ordering, kitchen tickets, and inventory — free for your first 100 orders/month. No card processor lock-in. Setup in 5 minutes.*

**Primary CTA:** `Start Free — No card`
**Secondary CTA:** `Watch a 90-second tour` (opens video modal)

**Below the CTAs:**

- A real product screenshot of staff-web on a tablet + mobile on a phone, side by side.
- A small strip: *"Works on the tablet you already own. 20 languages. No setup fees."*

### Section 2 — Pain agitation (1 screen)

*"Running a small cafe shouldn't feel like running an airport."*

3-column with icons:

- **Lost tickets** — Paper orders disappear. The kitchen blames the floor. You lose customers.
- **Surprise software bills** — Toast charges 2.99% on every card. At $10K/mo, that's $300/mo before any subscription.
- **Stuck behind the counter** — You can't leave because nobody else can see what's happening.

### Section 3 — The Gustri promise

*"One simple platform. Your phone is the command center."*

Hero screenshot: owner's phone showing dashboard with live orders, with a cafe scene in the background. Caption: *"See every order, every table, every shift — from anywhere."*

### Section 4 — "How it works" in 3 steps

1. **Sign up free** — Email + password. No card. 30 seconds.
2. **Add your menu** — Or scan it. Done in under 10 minutes.
3. **Print QR codes for tables** — Customers order from their phone. You run the kitchen.

### Section 5 — Features grouped by job-to-be-done

Three columns, each with 3-4 features:

**Run a shift**

- POS, Kitchen Display, Table Management, Waiter Calls

**Manage from anywhere**

- Mobile staff app, Live orders, Realtime dashboard, Multi-staff roles

**Save real money**

- Inventory tracking, Waste logging, Expense tracking, No card processor lock-in

### Section 6 — Affordability proof (math)

A two-column comparison. Left: "What you'd pay with Toast on $10K/mo in card sales." Right: "What you'd pay with Gustri."

Toast: $165 software + $299 in card fees = **$464/mo**
Gustri: $25 software + $0 forced fees = **$25/mo**

*"Same volume. Same features. $5,300 saved per year."*

(Use real numbers from existing [free-pos-systems blog post](../apps/marketing/src/content/blog/free-pos-systems-for-restaurants.mdx).)

### Section 7 — Built for emerging markets (multilingual differentiator)

*"Your kitchen staff don't all speak English. We get it."*

Screenshot of the staff-web in 4 languages side by side (RU, AZ, TR, EN). Caption: *"Every staff member uses the language they're comfortable in. 20 languages supported, including Azerbaijani, Russian, Turkish, Uzbek, Kazakh, Georgian."*

### Section 8 — Social proof

Logo wall (when we have 3+ cafes willing): "Cafes running on Gustri"
+ 2-3 short testimonials with photos: "I save 5 hours a week" / "I caught $400 in food waste in the first month" / "My waiters figured it out in a day."

### Section 9 — Pricing snapshot

Mini-version of the pricing cards (4 tiers) + link to full pricing page.

### Section 10 — Trust strip

- "No credit card to start"
- "Cancel anytime"
- "Your data, your control — GDPR-aligned"
- "Hosted on AWS, encrypted at rest"
- Sub-processor and security links

### Section 11 — FAQ (top 5 conversion blockers only)

Pull from existing FAQ — but make these top:

1. Is it actually free? *(yes, forever, ≤100 orders/mo)*
2. What hardware do I need? *(any tablet you already have)*
3. How long does setup take? *(5–15 minutes)*
4. Can I cancel? *(anytime, no penalty)*
5. Is my data secure? *(yes — link to security page)*

### Section 12 — Final CTA

*"Open Gustri before your next shift starts."*

`Start Free` (primary) | `Book a 15-min demo` (secondary)

---

## 🧩 Recommended feature-section structure

For each feature, use this 4-part frame:

```
[ICON]  Feature title
  └─ Operational problem (1 sentence, observable)
  └─ Product solution (1 sentence, what Gustri does)
  └─ Business benefit (1 sentence, $/time/peace-of-mind outcome)
  └─ [Screenshot or short loop video]
```

Concrete examples for the 12 current features:

### Point of Sale

- **Problem:** Your old POS is from 2009. Waiters dread it. New hires need a day of training.
- **Solution:** A clean POS that runs on any tablet, in your staff's language.
- **Benefit:** New waiters take orders within 10 minutes of opening the app.

### QR Ordering

- **Problem:** Customers wait. Waiters get tied up. Tickets get lost in translation.
- **Solution:** Customers scan a QR at the table and order from their phone.
- **Benefit:** Faster turn times, fewer mistakes, no missed upsells.

### Kitchen Display

- **Problem:** Paper tickets pile up. Orders get missed. The line cook yells at the waiter.
- **Solution:** Live order queue on any screen in the kitchen. New tickets pop in instantly.
- **Benefit:** Nothing gets lost. The kitchen runs calmer.

### Delivery Management

- **Problem:** Phone orders, courier confusion, missed pickups.
- **Solution:** Delivery orders in the same flow as dine-in, with courier status.
- **Benefit:** Stop juggling Telegram, WhatsApp, and phone calls.

### Table Management

- **Problem:** "Is table 7 done?" "How long has 12 been waiting?" "Who's covering 3?"
- **Solution:** Live table map showing status, time elapsed, and assigned waiter.
- **Benefit:** Floor managers see the whole room in one glance.

### Split Payments

- **Problem:** Six friends, one bill, six cards, ten minutes of math.
- **Solution:** Split by item, by amount, or evenly — in three taps.
- **Benefit:** Tables turn over faster. Waiters move on faster.

### Inventory Tracking

- **Problem:** You order based on gut. Sometimes you run out of milk. Sometimes you throw out croissants.
- **Solution:** Track stock levels and get alerts before you run out.
- **Benefit:** Stop the daily $50 mistakes that add up to thousands a year.

### Expense Tracking

- **Problem:** Receipts in a drawer. Suppliers paid in cash. No idea where the money goes.
- **Solution:** Log expenses by category, from your phone, in seconds.
- **Benefit:** At month-end, you know exactly where your money went.

### Waste Logging

- **Problem:** Food goes in the bin. You don't know how much, or why.
- **Solution:** Log waste in 2 taps — what, how much, why.
- **Benefit:** Spot the waste patterns. A 5% reduction is real money.

### Staff Scheduling

- **Problem:** Shifts on paper. Texts at 2am. Nobody knows who's working Sunday.
- **Solution:** A shared schedule everyone sees on their phone.
- **Benefit:** Fewer no-shows. Fewer arguments. No 2am texts.

### Task Management

- **Problem:** Opening checklist gets skipped. Cleaning gets forgotten on busy days.
- **Solution:** Assign tasks to shifts. Staff check them off.
- **Benefit:** Standards don't slip just because you weren't there.

### Customer Feedback

- **Problem:** Unhappy customers don't tell you — they tell Google.
- **Solution:** Customers send feedback through their QR menu, before they leave.
- **Benefit:** Fix problems while they're still in your cafe, not in a 1-star review.

---

## 🚀 Recommended refactor roadmap

Prioritized by business impact × speed. Each phase ships independently.

### Phase 1 — Foundational fixes (week 1, highest ROI)

1. **Fix "Sign in" → /pricing bug** ([header.tsx:80-93](../apps/marketing/src/components/layout/header.tsx#L80-L93)) — point it to staff-web login.
2. **Unify "Start Free" destination** — all → `/signup` directly. No detour through /pricing.
3. **Cut signup form to 2 fields** (email + password). Move name + restaurant to first dashboard load.
4. **Add `og:image` to layout** + per-page OG images via `opengraph-image.tsx`.
5. **Add JSON-LD**: Organization, SoftwareApplication, FAQPage (homepage FAQ).
6. **Add Plausible or PostHog** analytics. Cannot improve conversion without measuring it.
7. **Rewrite hero headline + sub** along the lines proposed above. A/B if traffic allows.
8. **Add microcopy under every Start Free CTA**: *"No credit card. 5-minute setup. Free forever for ≤100 orders/mo."*

### Phase 2 — Product proof (week 2-3)

1. **Add product screenshots** to hero, features, mobile section. Use real screens from staff-web + mobile.
2. **Build `/demo` route** with a 90-second product video (or interactive read-only sandbox).
3. **Build the affordability/math section** (Toast comparison with real numbers).
4. **Add testimonials** — even 3 from early Baku cafes. Photos > logos.
5. **Restructure homepage** to the 12-section order above.
6. **Group features by JTBD** (Run a shift / Manage anywhere / Save money) — refactor [features.tsx](../apps/marketing/src/components/home/features.tsx) accordingly.

### Phase 3 — SEO & content depth (week 3-5)

1. **Build comparison pages**: `/vs/toast`, `/vs/square`, `/vs/loyverse`, `/vs/iiko` — promoted from the existing blog content.
2. **Build product deep-dive pages**: `/product/pos`, `/product/qr-ordering`, `/product/kitchen-display`, `/product/mobile-app`, `/product/inventory`, `/product/delivery`.
3. **Build solutions pages**: `/solutions/cafes`, `/solutions/coffee-shops`, `/solutions/bakeries`, `/solutions/tea-houses`.
4. **Add 8-10 more blog posts** focused on operational guides (waste reduction, QR menu setup, staff scheduling, inventory math).
5. **Generate per-page OG images** programmatically (Next.js 14 `ImageResponse`).

### Phase 4 — Pricing + onboarding optimization (week 5-6)

1. **Add annual pricing toggle** (15-20% discount).
2. **Add pricing comparison table** ("vs Toast / Square at this volume").
3. **Reframe Free plan** as foothold not limit.
4. **Add "what happens next" reassurance** to signup page.
5. **Add Google SSO / magic link** signup.
6. **Add `?plan=X` echo** on signup page so users see their chosen plan reflected.
7. **Add `/pricing/calculator`** — interactive "how much you'd save" tool.

### Phase 5 — Trust & polish (week 6-8)

1. **Build `/security` page** (RLS, encryption at rest/in transit, sub-processors, AWS, GDPR).
2. **Build `/customers`** page with logo wall and 1-2 case studies.
3. **Build `/changelog`** route — auto-generated from a `content/changelog/` dir, MDX-based like blog.
4. **Add WhatsApp + tel: links** on contact page + footer.
5. **Add Sentry** to marketing site.
6. **Add `next/font` for Inter** if not already.
7. **Add `<link rel="preconnect">`** to Supabase domain.

### Phase 6 — Internationalization (week 8-10)

1. **Wire up [@gustri/i18n](../packages/i18n/) in marketing app** — at minimum: en, ru, tr, az, uz.
2. **Translate homepage + pricing + features pages** for those 5 locales.
3. **Add `hreflang` tags** + per-locale sitemap entries.
4. **Add language switcher** to header.
5. **Localized blog content** for ru/tr/az/uz markets — separate routes (e.g. `/ru/blog/...`).

### Phase 7 — Conversion iteration (ongoing)

1. A/B test hero headlines (3 variants).
2. A/B test CTA copy ("Start Free" vs "Open Free Account" vs "Try Gustri Free").
3. A/B test pricing layout (4 tiers vs 3 tiers vs slider).
4. Add exit-intent modal with "Watch 60-sec tour" offer.
5. Add scroll-depth and event tracking on every section.

---

## 📋 Recommended design direction

### Overall feel

**Modern + warm + operationally practical.** Not enterprise (no dark navy + finance gradients), not playful-startup (no clay illustrations + bouncing emojis), not B2C consumer (no big rounded card shadows). Aim for: *the dashboard a competent cafe owner would design for themselves.*

Closest references: Linear (clarity), Resend (calm), Cal.com (warmth), Posthog landing pages (depth without enterprise feel).

### Typography

- **Body:** Inter (current) is fine.
- **Display:** Add a slightly distinctive headline face — Geist, Plus Jakarta Sans, or General Sans. Pair: Inter (body) + Plus Jakarta Sans (display).
- **Scale:** Define a clear ramp — `display-xl` (60-72px), `display-lg` (48px), `heading-1` (36px), `heading-2` (28px), `body-lg` (18px), `body` (16px), `caption` (14px). Build into [@gustri/design-tokens](../packages/design-tokens/) for cross-app reuse.
- **Line height:** Body 1.6, headings 1.15-1.2.
- **Tracking:** Tight on display (`-0.02em`), default on body.

### Color

- **Keep teal primary** (#367B8B) — distinctive, trustworthy.
- **Add a warm accent** for CTAs and highlights — terracotta (#D97757) or mustard (#E8B14A). Cafes are warm spaces; the marketing should feel warm.
- **Reserve teal for trust/navigation, warm for action.** Test which converts.
- **Neutral scale:** keep gray-50 to gray-950 (already in use), but enrich with a single off-white background (`#FAFAF9` warm-tinted) for sections.

### Spacing

- Already using [@gustri/design-tokens SPACING](../packages/design-tokens/) — extend it.
- Section vertical spacing: 96-128px on desktop, 64px on mobile.
- Hero needs more breathing room — current hero feels tight.

### Imagery & screenshots

- **Real product screenshots, not stock photos.** No iStock cafes.
- Each major feature gets a clean, browser/device-framed screenshot.
- Use [shots.so](https://shots.so) or [mockuuups](https://mockuuups.studio) for device framing.
- Show staff-web on a tablet, mobile app on a phone, customer QR menu on a phone — these three devices repeated throughout.
- For team/social proof: real photos of real cafes we work with. Not stock.

### Illustration

- Minimal. If used, line illustrations in the brand teal — no flat illustrations, no isometric, no 3D blobs.
- Consider hand-drawn-ish icons for the "pain agitation" section to add warmth.

### Animation

- **On scroll**: simple fade-up for sections (we already have the keyframes in [tailwind.config.ts](../apps/marketing/tailwind.config.ts#L39-L52) — wire them up via `IntersectionObserver` or [Motion One](https://motion.dev/) for lighter bundle than framer-motion).
- **Hero**: subtle parallax or a single looping demo video (silent autoplay, captioned).
- **Avoid**: framer-motion (heavy), Lottie (overkill), cursor effects, anything that doesn't directly aid comprehension.

### Screenshot strategy

1. Hero: tablet + phone side by side, real screens, dim background.
2. Each feature: one screenshot, one device, captioned.
3. KDS section: animated GIF of a new order popping in.
4. Mobile section: looping video of owner's phone scrolling through live orders.
5. QR section: photo of a real QR card on a real cafe table.
6. Multilingual section: 4-language side-by-side screenshot grid.

---

## 📈 Recommended SEO strategy

### Content pillars (4 main)

1. **Vs competitors** — `/vs/toast`, `/vs/square`, `/vs/loyverse`, `/vs/iiko`, `/vs/poster`, `/vs/r-keeper`
2. **Use cases** — `/solutions/cafes`, `/solutions/bakeries`, `/solutions/coffee-shops`, `/solutions/tea-houses`, `/solutions/small-restaurants`, `/solutions/delivery-kitchens`
3. **Operational guides** (blog) — practical, evergreen
4. **Localized content** — ru/tr/az/uz region-specific

### Long-tail keyword targets

- "free restaurant POS no credit card"
- "QR code ordering for small cafe"
- "Toast alternative for small restaurants"
- "Square POS alternative cafe"
- "best POS for coffee shop under $30/month"
- "cafe management software Baku" / "Istanbul" / "Almaty" (per locale)
- "restaurant inventory tracking app"
- "kitchen display system for cafe"
- "how to reduce food waste in cafe"
- "QR menu setup for restaurant"
- "manage cafe remotely from phone"

### Recommended initial 20 blog posts

1. ✅ Free POS systems for restaurants (have)
2. ✅ Gustri vs iiko (have)
3. ✅ Best cafe management systems (have)
4. ✅ How QR ordering increases revenue (have)
5. ✅ Restaurant inventory management guide (have)
6. Toast vs Square vs Gustri: which is right for your cafe?
7. The hidden cost of Toast's "free" plan (deep dive on fee math)
8. How to set up QR menus in 15 minutes
9. The 7 mistakes new cafe owners make with their POS
10. How to manage a cafe from your phone (case study)
11. Restaurant food waste: a real-world reduction playbook
12. How to schedule cafe staff without WhatsApp chaos
13. The opening checklist every cafe needs (free template)
14. Kitchen display systems: do small cafes actually need one?
15. POS hardware: what you actually need vs what vendors sell you
16. How to do split payments without slowing down service
17. Cafe analytics: 5 numbers you should check every morning
18. The case against Square for restaurants (and what to use instead)
19. How to take delivery orders without losing your mind
20. Multilingual staff: how to run a cafe when nobody speaks the same language

### Local SEO

- Create Google Business Profile (Baku).
- Build `/cafe-software/[city]` pages for top target cities: Baku, Tbilisi, Istanbul, Almaty, Tashkent, Bishkek, Yerevan.
- Each: 300-500 words of unique content + local cafe testimonial when available.

### Technical SEO checklist

- ✅ Sitemap.ts
- ✅ Robots.ts
- ❌ Add JSON-LD: Organization, SoftwareApplication, FAQPage, BreadcrumbList, Product, Article
- ❌ Add `og:image` + per-route OG images
- ❌ Add `next/font` for Inter (if not already)
- ❌ Add `hreflang` tags once internationalized
- ❌ Add canonical URLs explicitly
- ❌ Compress and serve all future images as AVIF + WebP via `next/image`
- ❌ Lighthouse audit + Core Web Vitals dashboard

---

## 🧪 Recommended user-testing scenarios

Test with **5 real small cafe owners** before launch — ideally 3 in target market (Baku/CIS), 2 outside.

### Scenarios

1. **"You're a cafe owner. Land on the homepage. Tell me in 10 seconds what this product is and who it's for."** *(measures positioning clarity)*
2. **"Without scrolling, tell me what 'Start Free' will do."** *(measures CTA clarity)*
3. **"Find out how much this costs."** *(measures pricing findability)*
4. **"You have 6 tables and do about 80 orders a day. Which plan do you need?"** *(measures plan-selection clarity)*
5. **"Sign up for a free account."** *(measures signup friction; observe drop-off points)*
6. **"What happens after you sign up? Do you have to pay? Do you have to install anything?"** *(measures onboarding clarity)*
7. **"On your phone, find pricing and start a free account."** *(measures mobile UX)*
8. **"Why would you trust this with your daily operations?"** *(measures trust)*
9. **"How is this different from Square / Toast / iiko / your current POS?"** *(measures differentiation)*
10. **"Imagine you signed up. What do you expect to see in the first 5 minutes?"** *(reveals onboarding expectations to design against)*

### What to watch for

- Where they pause and reread
- Where they scroll past without engaging
- Words they don't understand ("KDS"? "Multi-tenant"? "Realtime"?)
- What they expect a button to do vs what it does
- Whether they ever say the word "expensive" or "confusing"
- Whether they spontaneously mention competitors

### Mobile-specific testing

- Whole flow on a 360px-wide Android phone (not iPhone 15 Pro Max).
- Outdoor lighting / one-handed use.
- Slow 3G connection (Chrome DevTools throttling).

---

## ✅ Areas already strong — keep

Don't lose these in the refactor:

- **Lean codebase, clean component structure.** ([components/](../apps/marketing/src/components/) is well-organized — Pricing and FAQ already reused properly.)
- **Strict security headers** ([next.config.js](../apps/marketing/next.config.js)) — HSTS, CSP, X-Frame, Permissions-Policy are all properly configured.
- **Server-component bias** — ~71% server components is the right default for a marketing site.
- **Blog architecture** — MDX-based with [gray-matter](../apps/marketing/src/lib/blog.ts), file-based authoring is the right call for this stage.
- **Design system foundation** — [@gustri/design-tokens](../packages/design-tokens/) and shared spacing is already wired up. Build on this rather than starting over.
- **Existing blog content quality** — the Toast/Square fee math and the iiko comparison are *genuinely useful*. Don't dilute them; promote them.
- **Pricing structure (4 tiers)** is good in shape — needs reframing, not restructuring.
- **Privacy/Terms** are full and properly written. Trust-building groundwork is there.
- **Header scroll behavior** ([header.tsx:26-29](../apps/marketing/src/components/layout/header.tsx#L26-L29)) — the subtle backdrop-blur on scroll is a nice modern touch. Keep it.
- **Sitemap and robots.ts** — properly configured.
- **No animation-library bloat** — staying lean lets us add motion later without paying for it now.

---

## Pricing & Onboarding Funnel — Detailed Recommendations

### Ideal pricing page structure

```
┌──────────────────────────────────────────────────────────┐
│  Hero                                                    │
│   "Simple, transparent pricing. Free until you grow."    │
│   Monthly / Annual toggle (Save 17%)                     │
├──────────────────────────────────────────────────────────┤
│  Pricing cards (4 tiers, Pro highlighted)                │
│   Each card includes:                                    │
│   - Plan name + price                                    │
│   - "Best for..." (1 sentence)                           │
│   - 5-7 bulleted features                                │
│   - "Includes everything in [previous plan]"             │
│   - CTA with reassurance microcopy                       │
├──────────────────────────────────────────────────────────┤
│  Side-by-side comparison table                           │
│   (Expandable "See full comparison")                     │
│   Includes Toast/Square columns for context              │
├──────────────────────────────────────────────────────────┤
│  Affordability proof                                     │
│   "What you'd pay with Toast vs Gustri at your volume"   │
│   Interactive: drag a slider for monthly card sales      │
├──────────────────────────────────────────────────────────┤
│  Free plan deep-dive                                     │
│   "What you actually get for free, forever"              │
│   Screenshot of the staff-web running on free plan       │
│   "Free forever for ≤100 orders/month — no card needed"  │
├──────────────────────────────────────────────────────────┤
│  Upgrade path                                            │
│   "When should you upgrade?" — clear signals             │
│   "You can upgrade or downgrade anytime"                 │
├──────────────────────────────────────────────────────────┤
│  Trust strip                                             │
│   No credit card • Cancel anytime • No setup fees        │
│   • No transaction lock-in • GDPR-aligned                │
├──────────────────────────────────────────────────────────┤
│  FAQ (pricing-specific, 6-8 items)                       │
├──────────────────────────────────────────────────────────┤
│  Final CTA                                               │
│   "Start free in 30 seconds"                             │
└──────────────────────────────────────────────────────────┘
```

### Free-plan messaging (rewrite)

**Current** ([pricing.tsx](../apps/marketing/src/components/home/pricing.tsx)): treats Free as the entry-level limited plan.

**Recommended:** treat Free as a **permanent home for tiny cafes** + a **risk-free runway for growing ones**.

> ### Free, forever
> ### $0/mo
>
> Run a real cafe — POS, kitchen tickets, QR menus, basic analytics — without paying a cent until you grow past 100 orders/month.
>
> - **POS** for dine-in and takeout
> - **QR ordering** for up to 5 tables
> - **Kitchen display** on any device
> - **Basic analytics**
> - **Up to 100 orders/month**
> - **Community support**
>
> *No credit card. No expiration. Upgrade when you outgrow it.*
>
> `Start Free → /signup?plan=free`

### Plan-comparison clarity

Add a clear "What changes when you upgrade?" panel. Current bullet lists make it hard to see the *upgrade gradient*.

| | Free | Standard | Pro | Business |
|---|---|---|---|---|
| **Monthly price** | $0 | $10 | $25 | $70 |
| **Tables** | 5 | 10 | 20 | Unlimited |
| **Orders/mo** | 100 | 700 | 2,200 | Unlimited |
| **QR ordering** | ✓ | ✓ | ✓ | ✓ |
| **Kitchen display** | ✓ | ✓ | ✓ | ✓ |
| **Custom branding** | — | ✓ | ✓ | ✓ |
| **Inventory & waste** | — | — | ✓ | ✓ |
| **Staff scheduling** | — | — | ✓ | ✓ |
| **Multi-location** | — | — | — | ✓ |
| **API access** | — | — | — | ✓ |
| **Support** | Community | Email | Priority | Dedicated |

Add a column: "What you'd pay with Toast at the same volume" — show fee math.

### Upgrade motivation copy

Place at the bottom of the Free plan card:

> *Most cafes outgrow the Free plan around 80-90 orders/day. When you do, upgrading to Standard takes one click and unlocks branding + email support for $10/mo.*

And inside the dashboard (staff-web — for a future task, but flag it now): when a free-tier cafe hits 70 orders for the month, surface a non-blocking banner: *"You're at 70% of your free orders. Standard plan unlocks 700/mo + custom branding for $10/mo. Upgrade →"*

### Ideal CTA wording (per plan)

| Plan | Primary CTA | Microcopy beneath |
|---|---|---|
| Free | **Start Free — No card** | *Free forever for ≤100 orders/mo* |
| Standard | **Try Standard Free 14 days** | *Then $10/mo. Cancel anytime.* |
| Pro | **Try Pro Free 14 days** | *Then $25/mo. Cancel anytime. Most popular.* |
| Business | **Talk to us about Business** | *Custom onboarding, multi-location, API* |

### Ideal onboarding funnel

```
Marketing site (/signup)
   ├─ Email + password (2 fields only)
   ├─ "What plan?" inferred from ?plan=X query param
   └─ Signup with Supabase
        ↓
Email confirmation
        ↓
Staff-web /auth/callback
        ↓
Onboarding wizard (staff-web — track as separate task)
   1. "What's your cafe called?" (collect later — not at signup)
   2. "How many tables do you have?"
   3. "Pick a language for your staff"
   4. "Add your first 3 menu items" (or "Import from photo / CSV")
   5. "Print your first QR code"  ← First Aha Moment
        ↓
Dashboard with seed data + checklist
   ☑ Add menu items
   ☐ Invite staff
   ☐ Print table QR codes
   ☐ Take your first test order
   ☐ Set up kitchen display
        ↓
First real order → confetti / celebration
        ↓
Day 3 email: "Here are 3 things to try next"
Day 7 email: "You've taken X orders. Here's what cafes like yours do next."
Day 30 email: "You're approaching your free plan limit. Here's what unlocks at Standard."
```

### First-day activation strategy

Define the **activation moment** explicitly: *"First real (non-test) order taken through Gustri."*

Until that happens, the dashboard surfaces a persistent activation checklist. After it happens, the dashboard celebrates and shifts to operational mode.

### Trust-building onboarding sections (on marketing site)

Add a dedicated section on the homepage or pricing page:

> ### What happens after you click "Start Free"?
>
> 1. **Confirm your email** (30 seconds)
> 2. **Add your cafe details** (1 minute)
> 3. **Add 3 menu items** — or import from a photo (5 minutes)
> 4. **Print your first table QR code** (PDF generated for you)
> 5. **Take your first test order** — you're live
>
> *Total: 5–15 minutes. No credit card. No download. No installation.*

This single section removes most signup-stage objections.

### Onboarding screenshots to commission

1. Signup form (existing one, cleaned up to 2 fields)
2. Onboarding wizard step 1 — "Name your cafe"
3. Menu import — "Snap a photo of your menu and we'll do the rest" (aspirational; if not built, build it; it's a killer differentiator)
4. QR code generation screen with a printable PDF preview
5. Dashboard with first order appearing in real-time
6. Mobile staff app on a phone showing the same order

These 6 screenshots, arranged as a numbered scroll on the homepage, do more conversion lifting than any amount of marketing copy.
