import { describe, expect, it } from 'vitest';
import { ITEM_STATUS_PROGRESS, isItemStatusAtOrPast } from '../constants';

describe('item-status progression (shared by web + mobile kitchen)', () => {
  it('orders pending < preparing < ready < served', () => {
    expect(ITEM_STATUS_PROGRESS.pending).toBeLessThan(ITEM_STATUS_PROGRESS.preparing);
    expect(ITEM_STATUS_PROGRESS.preparing).toBeLessThan(ITEM_STATUS_PROGRESS.ready);
    expect(ITEM_STATUS_PROGRESS.ready).toBeLessThan(ITEM_STATUS_PROGRESS.served);
  });

  it('keeps cancelled below pending so it never blocks order advancement', () => {
    expect(ITEM_STATUS_PROGRESS.cancelled).toBeLessThan(ITEM_STATUS_PROGRESS.pending);
  });

  describe('isItemStatusAtOrPast', () => {
    it('is true for equal status', () => {
      expect(isItemStatusAtOrPast('ready', 'ready')).toBe(true);
    });

    it('is true when actual is further along', () => {
      expect(isItemStatusAtOrPast('served', 'ready')).toBe(true);
      expect(isItemStatusAtOrPast('ready', 'preparing')).toBe(true);
    });

    it('is false when actual is behind the target', () => {
      expect(isItemStatusAtOrPast('preparing', 'ready')).toBe(false);
      expect(isItemStatusAtOrPast('pending', 'served')).toBe(false);
    });

    it('treats cancelled as behind every live target', () => {
      expect(isItemStatusAtOrPast('cancelled', 'ready')).toBe(false);
      expect(isItemStatusAtOrPast('cancelled', 'pending')).toBe(false);
    });
  });
});
