import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getKitchenUrgencyBand, TIME_ELAPSED_THRESHOLDS } from '../constants';

// Automated proxy for MOBILE_PARITY_PLAN.md Phase 5.1 / 5.3 / 5.4 — the
// trio of manual tests that all reduce to one operational question:
//
//   "Given an order at minute X with status Y, do web and mobile show the
//    same urgency band?"
//
// We can't run a rush-hour shift or a 5-second-flash UX study in CI, but
// we can lock the canonical band classifier — the contract both platforms
// MUST hit for the visual hierarchy to converge. If the function below
// drifts, the kitchen displays drift; this test catches that.

const { WARNING, ELEVATED, CRITICAL } = TIME_ELAPSED_THRESHOLDS;

describe('Phase 5.1/5.3/5.4 — kitchen urgency band contract', () => {
  describe('threshold boundaries (status=preparing)', () => {
    it.each([
      [0, 'default'],
      [WARNING - 1, 'default'],
      [WARNING, 'warning'],
      [WARNING + 1, 'warning'],
      [ELEVATED - 1, 'warning'],
      [ELEVATED, 'elevated'],
      [ELEVATED + 1, 'elevated'],
      [CRITICAL - 1, 'elevated'],
      [CRITICAL, 'critical'],
      [CRITICAL + 1, 'critical'],
      [120, 'critical'],
    ] as const)('minute=%i → %s', (minutes, expected) => {
      expect(getKitchenUrgencyBand({ minutesElapsed: minutes, status: 'preparing' })).toBe(
        expected,
      );
    });
  });

  describe('status overrides beat time-based bands', () => {
    it('status=ready wins over critical minutes', () => {
      expect(getKitchenUrgencyBand({ minutesElapsed: 999, status: 'ready' })).toBe('ready');
    });

    it('status=new wins over critical minutes (just-arrived but already old created_at)', () => {
      expect(getKitchenUrgencyBand({ minutesElapsed: 999, status: 'new' })).toBe('new');
    });

    it('allItemsReady wins even when status=preparing', () => {
      expect(
        getKitchenUrgencyBand({
          minutesElapsed: 5,
          status: 'preparing',
          allItemsReady: true,
        }),
      ).toBe('ready');
    });

    it('allItemsReady wins over critical minutes (cook finished but order not yet flipped)', () => {
      expect(
        getKitchenUrgencyBand({
          minutesElapsed: CRITICAL + 5,
          status: 'preparing',
          allItemsReady: true,
        }),
      ).toBe('ready');
    });

    it('ready check precedes new check (terminal beats untriaged)', () => {
      // Inconsistent state: status=new but items all ready. ready wins.
      expect(
        getKitchenUrgencyBand({
          minutesElapsed: 0,
          status: 'new',
          allItemsReady: true,
        }),
      ).toBe('ready');
    });
  });

  describe('unknown / unusual statuses', () => {
    it('unknown status falls through to time-based bands', () => {
      expect(getKitchenUrgencyBand({ minutesElapsed: 5, status: 'frobnicated' })).toBe('default');
      expect(getKitchenUrgencyBand({ minutesElapsed: 15, status: 'frobnicated' })).toBe('elevated');
    });

    it('empty status falls through to time-based bands', () => {
      expect(getKitchenUrgencyBand({ minutesElapsed: 25, status: '' })).toBe('critical');
    });
  });

  describe('input sanitization', () => {
    it('negative minutes clamp to 0 (clock skew protection)', () => {
      expect(getKitchenUrgencyBand({ minutesElapsed: -5, status: 'preparing' })).toBe('default');
    });
  });

  describe('threshold ordering invariant', () => {
    it('WARNING < ELEVATED < CRITICAL (otherwise bands become unreachable)', () => {
      expect(WARNING).toBeLessThan(ELEVATED);
      expect(ELEVATED).toBeLessThan(CRITICAL);
    });
  });

  describe('canonical helper is wired up on both platforms', () => {
    // Both kitchen surfaces should derive their urgency band from this
    // helper, not from a locally-reinvented `if (minutes >= …)` chain.
    // If either file drops the import or stops calling the helper, the
    // platforms start drifting again and Phase 5.1/5.3/5.4 silently
    // regresses. Source-scanner style: see lint-guard-zustand.test.ts.
    const REPO_ROOT = resolve(dirname(__filename), '..', '..', '..', '..');
    const CALLERS = [
      'apps/mobile/src/components/kitchen/KitchenOrderCard.tsx',
      // The web kitchen controller hook owns the urgency-band wiring (the page
      // is a thin orchestrator since the kitchen-page decomposition).
      'apps/staff-web/src/components/kitchen/use-kitchen-display.tsx',
    ] as const;

    it.each(CALLERS)('%s imports and calls getKitchenUrgencyBand', (relPath) => {
      const src = readFileSync(resolve(REPO_ROOT, relPath), 'utf8');
      expect(src).toMatch(
        /import\s*\{[^}]*\bgetKitchenUrgencyBand\b[^}]*\}\s*from\s*['"]@gustri\/core['"]/s,
      );
      expect(src).toMatch(/\bgetKitchenUrgencyBand\s*\(/);
    });
  });
});
