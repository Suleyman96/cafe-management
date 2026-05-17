import { describe, expect, it } from 'vitest';
import {
  type BadgeConfig,
  ORDER_STATUS_HEX,
  ROLE_BADGE_HEX,
  type StatusColorPair,
  TABLE_STATUS_HEX,
  WAITER_CALL_REASON_HEX,
} from '../colors';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function assertBadgeConfig(name: string, key: string, cfg: BadgeConfig) {
  expect(cfg.bg, `${name}.${key}.bg`).toMatch(HEX_RE);
  expect(cfg.text, `${name}.${key}.text`).toMatch(HEX_RE);
  expect(cfg.labelKey, `${name}.${key}.labelKey`).toBeTypeOf('string');
  expect(cfg.labelKey.length, `${name}.${key}.labelKey must be non-empty`).toBeGreaterThan(0);
  if (cfg.border !== undefined) expect(cfg.border).toMatch(HEX_RE);
  if (cfg.iconName !== undefined) expect(cfg.iconName).toBeTypeOf('string');
  if (cfg.pulse !== undefined) expect(cfg.pulse).toBeTypeOf('boolean');
}

describe('BadgeConfig contract', () => {
  it('every ORDER_STATUS_HEX entry conforms to BadgeConfig', () => {
    for (const [key, cfg] of Object.entries(ORDER_STATUS_HEX)) {
      assertBadgeConfig('ORDER_STATUS_HEX', key, cfg);
    }
  });

  it('every TABLE_STATUS_HEX entry conforms to BadgeConfig', () => {
    for (const [key, cfg] of Object.entries(TABLE_STATUS_HEX)) {
      assertBadgeConfig('TABLE_STATUS_HEX', key, cfg);
    }
  });

  it('every ROLE_BADGE_HEX entry conforms to BadgeConfig', () => {
    for (const [key, cfg] of Object.entries(ROLE_BADGE_HEX)) {
      assertBadgeConfig('ROLE_BADGE_HEX', key, cfg);
    }
  });

  it('ORDER_STATUS_HEX covers every documented order status', () => {
    const expected = [
      'pending_approval',
      'new',
      'preparing',
      'ready',
      'served',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'closed',
    ];
    for (const status of expected) {
      expect(ORDER_STATUS_HEX[status], `missing entry for "${status}"`).toBeDefined();
    }
  });

  it('TABLE_STATUS_HEX covers every documented table status', () => {
    const expected = ['free', 'occupied', 'reserved', 'closed'];
    for (const status of expected) {
      expect(TABLE_STATUS_HEX[status], `missing entry for "${status}"`).toBeDefined();
    }
  });

  it('ROLE_BADGE_HEX covers every documented user role', () => {
    const expected = ['owner', 'admin', 'kitchen', 'waiter'];
    for (const role of expected) {
      expect(ROLE_BADGE_HEX[role], `missing entry for "${role}"`).toBeDefined();
    }
  });

  it('StatusColorPair is structurally compatible with BadgeConfig', () => {
    // Compile-time: a BadgeConfig is assignable to a StatusColorPair via Pick.
    const cfg: BadgeConfig = ORDER_STATUS_HEX.new;
    const pair: StatusColorPair = cfg;
    expect(pair.bg).toBe(cfg.bg);
    expect(pair.text).toBe(cfg.text);
  });

  it('WAITER_CALL_REASON_HEX uses solid hexes (not bg/text pairs)', () => {
    for (const [key, value] of Object.entries(WAITER_CALL_REASON_HEX)) {
      expect(value, `WAITER_CALL_REASON_HEX.${key}`).toMatch(HEX_RE);
    }
  });
});
