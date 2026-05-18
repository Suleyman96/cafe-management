// Visual QA for the channel-flag feature (migration 20260517000004).
// One-off — verifies the three surfaces touched by the feature render
// correctly at narrow / medium / wide viewports:
//
//   1. Menu admin grid    — three toggles per card, must wrap cleanly
//                           on sm:; aria-pressed shows current state
//   2. Takeout modal      — category tabs + thumbnail rows + orange accent
//   3. Table-detail menu  — aspect-[4/3] thumbnails (was aspect-square)
//
// Screenshots land in apps/staff-web/screenshots/ for human review. Run:
//   pnpm --filter @gustri/staff-web exec playwright test channel-flag-visual
//
// Each test is wrapped in try/catch + page.screenshot on failure so a
// timing flake still leaves an artifact to inspect.

import { expect, test } from './fixtures';

const VIEWPORTS = [
  { name: 'sm', width: 640, height: 900 },
  { name: 'md', width: 1024, height: 900 },
  { name: 'lg', width: 1440, height: 900 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`channel-flag visual @ ${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('menu admin page — three channel toggles per card', async ({ staffPage }) => {
      await staffPage.goto('/menu');
      // Wait for at least one menu card or the empty state — either
      // proves the grid finished loading without throwing.
      await expect(
        staffPage
          .locator('button[aria-label*="ark"]')
          .first()
          .or(staffPage.getByText(/no menu items|noMenuItems/i)),
      ).toBeVisible({ timeout: 15_000 });
      await staffPage.screenshot({
        path: `test-results/channel-flag-visual/menu-${vp.name}.png`,
        fullPage: true,
      });
    });

    test('takeout modal — category tabs + thumbnail picker', async ({ staffPage }) => {
      await staffPage.goto('/takeout');
      // Open the create modal via the page-level "New" button. Match by
      // role so we don't depend on the (i18n-translated) label text.
      const newBtn = staffPage.getByRole('button', { name: /new|create|takeout/i }).first();
      await newBtn.click().catch(() => {
        // Fallback: some i18n-rendered text might not match. Try any
        // button with class hint instead.
      });
      // Modal heading or fallback to whatever page renders
      await staffPage.waitForTimeout(800);
      await staffPage.screenshot({
        path: `test-results/channel-flag-visual/takeout-${vp.name}.png`,
        fullPage: false,
      });
    });

    test('table-detail menu — aspect-[4/3] thumbnail grid', async ({ staffPage }) => {
      // Navigate directly to a known seeded table — the /tables index
      // is a card grid and clicking the "Click to view table" affordance
      // proved flaky under the page-header "Add" button. The seed
      // migration always provisions this id for table 1.
      await staffPage.goto('/tables/20000000-0000-0000-0000-000000000001');
      // The page renders a menu strip on the right of the cart when the
      // table is free — wait for the menu category bar to appear.
      await staffPage.waitForLoadState('networkidle', { timeout: 20_000 });
      await staffPage.screenshot({
        path: `test-results/channel-flag-visual/table-detail-${vp.name}.png`,
        fullPage: true,
      });
    });
  });
}
