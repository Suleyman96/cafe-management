# customer-web Phase 5 — Mobile Usability & Accessibility

Index: [21-CW-PROD-AUDIT-OVERVIEW.md](21-CW-PROD-AUDIT-OVERVIEW.md)

Eight items. The customer-web's primary surface is a phone in a restaurant, often
held one-handed while balancing a menu and a drink. Touch targets, focus traps,
RTL, iOS Safari quirks. Ship after Phase 4 and before public launch in
RTL-language markets.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` shipped · `[-]` won't fix

---

## A1. Touch targets under 44×44

WCAG 2.5.5 minimum + Apple HIG 44pt + Material 48dp. Every item below is below
that floor today.

- [ ] **Where + fixes.**
  1. **Menu search filter toggle** — [menu-screen.tsx:171-184](../apps/customer-web/src/components/menu/menu-screen.tsx#L171-L184). Currently `h-7 w-7` (28×28). Fix: `h-11 w-11` (44×44); shrink the inner icon if it now looks chunky.
  2. **Clear-search X** — [menu-screen.tsx:163-169](../apps/customer-web/src/components/menu/menu-screen.tsx#L163-L169). Currently `h-6 w-6` (24×24). Fix: `h-11 w-11`. Or wrap the inner icon in a button with `padding` so the hit area is 44×44 while visual stays 24×24.
  3. **Cancel-item +/- buttons** — [order-status.tsx:462-477](../apps/customer-web/src/components/order/order-status.tsx#L462-L477). Currently `h-10 w-10` (40×40). Fix: `h-11 w-11`.
  4. **Order-status header back arrow** — [order-status.tsx:186-188](../apps/customer-web/src/components/order/order-status.tsx#L186-L188). `<Button size="icon">` resolves to the smallest variant in `@gustri/ui-web`. Verify the rendered hit area is ≥44; if not, bump the icon button size variant.
  5. **Call-Staff FAB** — [layout.tsx:75](../apps/customer-web/src/app/table/[tableId]/layout.tsx#L75). Currently `px-2.5 py-1.5` + `text-[10px]` icon = ~28px tall. Fix: `px-4 py-3` minimum, OR redesign to a circular FAB at `h-14 w-14`. The label text can shrink/hide on small screens.
  6. **Cart-item quantity controls in `MenuCartSidebar`** — [menu-cart-sidebar.tsx:106-121](../apps/customer-web/src/components/menu/menu-cart-sidebar.tsx#L106-L121). Currently `h-6 w-6` (24×24). Fix: wrap in `h-11 w-11` button with smaller visual icon.
- [ ] **Verification.**
  - Use Chrome DevTools "Show ruler on hover" to confirm hit areas are ≥44×44 for every interactive element.
  - Real-device test on a 6.7" phone — every tap lands on the first try.
- [ ] **Done when.** Every interactive element meets the 44×44 floor, no visual regression on small screens.

---

## A2. RTL support (Arabic, Persian)

- [ ] **Where.**
  - Lang attribute: [components/ui/html-lang-setter.tsx](../apps/customer-web/src/components/ui/html-lang-setter.tsx)
  - FAB position: [layout.tsx:75](../apps/customer-web/src/app/table/[tableId]/layout.tsx#L75) (`fixed bottom-5 left-3`)
  - Sticky headers throughout
- [ ] **What.** `lang` is set but no companion `dir`. Sticky headers, fixed-bottom cart bars, and the FAB position (`left-3`) will look wrong in RTL.
- [ ] **Why it matters.** AR + FA are required markets per the 20-locale rule. Customers in those locales should not see flipped sticky bars or back arrows pointing the wrong way.
- [ ] **Fix steps.**
  1. **`dir` attribute.** Modify `HtmlLangSetter` to set `<html dir="rtl">` for `language ∈ { 'ar', 'fa' }`.
  2. **Audit `left-`/`right-` Tailwind classes** for `rtl:` variants:
     - FAB: `left-3 rtl:left-auto rtl:right-3`.
     - Sticky headers with `left-` / `right-` icons (back arrow, close X): apply `rtl:` flip where appropriate.
     - The `MapPin` icon left of phone/address rows in delivery form: usually OK due to Tailwind's `flex` handling but verify visually.
  3. **Back arrow icon.** `ArrowLeft` from `lucide-react` does *not* auto-flip. Either swap to `ArrowRight` in RTL or apply `rtl:scale-x-[-1]` to flip it.
  4. **Modal close X.** Decorative, no flip needed.
  5. **Toast position.** Sonner `position="top-center"` works in both directions.
  6. **Run translation review** on AR + FA strings for one full e2e flow to catch any text that bleeds out.
- [ ] **Verification.**
  - Switch to AR → sticky FAB on the right, back arrow points right, headers feel native.
  - Switch to FA → same.
  - Switch back to EN → no regression.
- [ ] **Done when.** RTL renders correctly in AR + FA without flipped affordances.

---

## A3. Language picker scroll affordance

- [ ] **Where.** [apps/customer-web/src/components/table/table-landing.tsx:545-602](../apps/customer-web/src/components/table/table-landing.tsx#L545-L602)
- [ ] **What.** 20+ language buttons in a `grid-cols-4 max-h-[50vh] overflow-y-auto scrollbar-hide`. No visible scrollbar; customer thinks only the first 5 rows exist.
- [ ] **Why it matters.** Customers in lower-listed locales (TR, RU, UK, UZ, etc.) cannot find their language.
- [ ] **Fix steps.**
  1. Remove `scrollbar-hide` for this container — show the native scrollbar.
  2. **Or:** add a sticky bottom gradient shadow that indicates "more below" — `background: linear-gradient(to top, rgba(0,0,0,0.6), transparent)` over the last ~20px of the visible area, fading out as the user scrolls to the bottom (track via `scrollHeight - scrollTop - clientHeight`).
  3. **Or:** virtualize the list (overkill for 20 items).
  4. Pick option 2 — it preserves the design language and gives a clear affordance.
- [ ] **Verification.**
  - Open language picker on a 5.5" phone screen → visible gradient at bottom hints at scroll.
  - Scroll to bottom → gradient disappears.
- [ ] **Done when.** Scroll affordance visible, all 20 languages discoverable.

---

## A4. `inputMode` and `autocomplete` on delivery form inputs

- [ ] **Where.** [apps/customer-web/src/app/delivery/page.tsx:138-193](../apps/customer-web/src/app/delivery/page.tsx#L138-L193)
- [ ] **What.** `type="tel"` is present but `inputMode="tel"` adds belt-and-suspenders on older Android. None of the inputs use `autocomplete` attributes, so the system "use saved info" prompt never fires for customers who have it stored.
- [ ] **Why it matters.** Speeds up checkout for returning customers. One less reason to abandon.
- [ ] **Fix steps.**
  1. **Name input.** Add `autocomplete="name"` and `autocapitalize="words"`.
  2. **Phone input.** Add `autocomplete="tel"` and `inputMode="tel"`.
  3. **Address textarea.** Add `autocomplete="street-address"` and `autocapitalize="sentences"`.
  4. **Notes textarea.** No autocomplete; `autocapitalize="sentences"` only.
  5. Test on both iOS Safari and Android Chrome — autofill UX varies.
- [ ] **Verification.**
  - On iOS with contact info saved → tapping the name field offers the autofill chip.
  - On Android with browser autofill → same.
- [ ] **Done when.** Autofill prompts fire on supported devices, no regression for users without saved info.

---

## A5. Focus traps in modals (cancel-order, cancel-item, menu-item, language picker)

- [ ] **Where.**
  - Cancel order: [order-status.tsx:411-440](../apps/customer-web/src/components/order/order-status.tsx#L411-L440)
  - Cancel item: [order-status.tsx:442-510](../apps/customer-web/src/components/order/order-status.tsx#L442-L510)
  - Menu item: [menu-item-modal.tsx:50-220](../apps/customer-web/src/components/menu/menu-item-modal.tsx#L50-L220)
  - Language picker: [table-landing.tsx:545-602](../apps/customer-web/src/components/table/table-landing.tsx#L545-L602)
- [ ] **What.** Modals render as `fixed inset-0` overlays without focus management. Tab key escapes the modal; Escape doesn't close; focus doesn't return to the trigger on close.
- [ ] **Why it matters.** Accessibility baseline. Customers using keyboard nav (rare on phones, common on tablets used as menus) lose track of where they are.
- [ ] **Fix steps.**
  1. Adopt a small focus-trap helper. Options:
     - `@radix-ui/react-dialog` for the heavyweight modals (cancel-order, cancel-item) — overkill but consistent with shadcn pattern.
     - A bespoke `useFocusTrap(ref)` hook (~30 lines) that:
       - Records `document.activeElement` on mount.
       - On open: focuses the first focusable element inside `ref`.
       - On Tab/Shift+Tab: wraps focus inside `ref`.
       - On Escape: calls `onClose`.
       - On unmount: restores focus to the recorded element.
  2. Apply to all four modal sites.
  3. The menu-item modal already has `role="dialog" aria-modal="true"` — add `aria-labelledby` pointing at the title and `onKeyDown` for Escape.
- [ ] **Verification.**
  - Open cancel-item modal → press Tab repeatedly → focus stays inside modal.
  - Press Escape → modal closes, focus returns to the X button on the order row.
  - Same for all four modal surfaces.
- [ ] **Done when.** Focus trap + Escape + focus restore work in all four modals.

---

## A6. iOS Safari `h-screen` is broken — use `dvh` / `100svh`

- [ ] **Where.**
  - [menu-screen.tsx:119](../apps/customer-web/src/components/menu/menu-screen.tsx#L119) (`h-screen`)
  - Any other full-bleed `h-screen` / `min-h-screen` usage (audit)
- [ ] **What.** `h-screen` resolves to `100vh` which on iOS Safari includes the URL bar height even when collapsed. Result: bottom content is clipped under the URL bar.
- [ ] **Why it matters.** The `MenuCartSidebar` bottom section is right where this clipping bites. Customers see their place-order button half-cut by the URL bar.
- [ ] **Fix steps.**
  1. Replace `h-screen` with `h-[100svh]` (small viewport height — excludes URL bar) for the menu shell. Tailwind 3.4 supports the `svh` / `dvh` / `lvh` variants natively via arbitrary values.
  2. Audit `min-h-screen` usages — most are fine because they're for content that should grow, but anywhere it pins a layout, prefer `min-h-[100svh]`.
  3. **Don't** mix `vh` and `svh` on the same layout — pick one. For interactive customer-facing flows, `svh` is the right default.
- [ ] **Verification.**
  - On iOS Safari 16+ → no clipping, place-order button fully visible.
  - On Chrome desktop → no regression (svh behaves like vh).
- [ ] **Done when.** No clipping observed on iOS test devices.

---

## A7. `aria-live` region for order status changes

- [ ] **Where.** [apps/customer-web/src/components/order/order-status.tsx:215-263](../apps/customer-web/src/components/order/order-status.tsx#L215-L263) (status banners)
- [ ] **What.** When realtime fires "preparing → ready," nothing is announced. Screen reader users see no update; sighted users see a colored banner change with no audible cue.
- [ ] **Why it matters.** Accessibility for blind users; also a UX improvement for sighted users who may have looked away.
- [ ] **Fix steps.**
  1. Wrap the status banner in an `aria-live="polite"` region.
  2. Use a single banner element whose content changes via React state, not a stack of conditional banners (otherwise the screen reader announces each one as they mount/unmount, which is too chatty).
  3. **Optional:** play a soft chime on status change (only after the customer interacts with the page once — browser autoplay policy). Behind a `settings.sound_notifications_enabled` flag.
- [ ] **Verification.**
  - VoiceOver on iOS → status changes announced.
  - Visual: banner change is smooth, no flash.
- [ ] **Done when.** aria-live wired, no chatty announcements.

---

## A8. Color contrast on hero text against `hero_image_url`

- [ ] **Where.** [apps/customer-web/src/components/table/table-landing.tsx:182-258](../apps/customer-web/src/components/table/table-landing.tsx#L182-L258)
- [ ] **What.** `text-white/30`, `text-white/40`, `text-white/50` against a customer-uploaded `hero_image_url`. Bright noon-beach photos make the welcome text unreadable.
- [ ] **Why it matters.** WCAG AA contrast failure on a customer-controlled image. Brand looks careless when text disappears.
- [ ] **Fix steps.**
  1. **Strengthen the gradient overlay** when `hero_image_url` is set. Current: `from-black/70 via-black/50 to-[#0C0C0E]`. Bump to `from-black/85 via-black/65 to-[#0C0C0E]` and/or add a uniform `bg-black/30` over the whole hero.
  2. **Or:** allow the restaurant owner to opt into a "dark overlay" toggle on the admin side that increases the gradient strength.
  3. **Or:** auto-detect dominant brightness server-side when the image is uploaded and stamp a `hero_image_brightness` int on cafe_settings; choose overlay strength based on it.
  4. Pick option 1 — cheapest, no DB change, ships in one PR.
- [ ] **Verification.**
  - Test with a bright hero (sunlit dish) → welcome text remains AA-readable.
  - Test with a dark hero (low-light restaurant interior) → no over-darkening.
- [ ] **Done when.** AA contrast satisfied on a range of test images.

---

## Phase 5 exit gate

All eight items shipped. Manual test matrix:

- **Devices:** iPhone SE (small screen), iPhone 14 Pro Max (large), Pixel 6a (Android budget), iPad Mini (tablet).
- **Browsers:** Safari iOS 16 + 17, Chrome Android, Firefox iOS.
- **Languages:** EN (baseline), AR (RTL), JA (vertical-ish), RU (long compound words), DE (long words), TR (special chars).
- **Tasks:** Scan QR → browse menu → add 3 items → place order → track. Each touch on first try.

Once Phase 5 ships, hand off to [27-CW-PROD-PHASE-6-PERFORMANCE.md](27-CW-PROD-PHASE-6-PERFORMANCE.md).
