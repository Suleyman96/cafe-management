import { describe, expect, it } from 'vitest';
import { type BadgeConfig, ORDER_STATUS_HEX, ROLE_BADGE_HEX, TABLE_STATUS_HEX } from '../colors';

// Automated proxy for MOBILE_PARITY_PLAN.md Phase 5.6 ("Mobile on 360dp
// Android 9 under restaurant lighting. Smallest readable text, badge
// legibility"). We can't ship a phone to a kitchen and check, but we can
// lock the contract that every fg/bg pair used in a status / role / table
// badge meets WCAG AA contrast — the floor for legible body text. The
// physical-world "restaurant lighting + glare" condition makes 4.5:1 a
// minimum, not a target; this test fails closed on any palette regression.

// WCAG 2.1 relative-luminance formula.
// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (full.length !== 6) throw new Error(`Invalid hex color: ${hex}`);
  const num = Number.parseInt(full, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

function channelLuminance(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrastRatio(fg: string, bg: string): number {
  const lf = relativeLuminance(hexToRgb(fg));
  const lb = relativeLuminance(hexToRgb(bg));
  const [lighter, darker] = lf >= lb ? [lf, lb] : [lb, lf];
  return (lighter + 0.05) / (darker + 0.05);
}

// WCAG AA thresholds.
const AA_NORMAL = 4.5; // body text < 18pt regular / < 14pt bold
const AA_LARGE = 3.0; // headline text — kept here for documentation, unused
void AA_LARGE;

function cases(
  record: Record<string, BadgeConfig>,
): Array<readonly [string, string, string, number]> {
  return Object.entries(record).map(
    ([id, cfg]) => [id, cfg.text, cfg.bg, contrastRatio(cfg.text, cfg.bg)] as const,
  );
}

describe('Phase 5.6 — WCAG AA badge contrast', () => {
  describe('formula sanity', () => {
    it('black on white ≈ 21:1', () => {
      expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    });

    it('white on black ≈ 21:1 (order-independent)', () => {
      expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
    });

    it('same color = 1:1', () => {
      expect(contrastRatio('#888888', '#888888')).toBeCloseTo(1, 5);
    });
  });

  describe('ORDER_STATUS_HEX', () => {
    it.each(
      cases(ORDER_STATUS_HEX),
    )('status=%s text=%s bg=%s contrast≈%f passes AA-normal', (_status, _text, _bg, ratio) => {
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  });

  describe('TABLE_STATUS_HEX', () => {
    it.each(
      cases(TABLE_STATUS_HEX),
    )('status=%s text=%s bg=%s contrast≈%f passes AA-normal', (_status, _text, _bg, ratio) => {
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  });

  describe('ROLE_BADGE_HEX', () => {
    it.each(
      cases(ROLE_BADGE_HEX),
    )('role=%s text=%s bg=%s contrast≈%f passes AA-normal', (_role, _text, _bg, ratio) => {
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  });
});
