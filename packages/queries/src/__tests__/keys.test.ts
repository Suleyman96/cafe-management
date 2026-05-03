import { describe, expect, it } from 'vitest';
import { NO_TENANT_KEY_SEGMENT, QUERY_KEYS, tenantKey } from '../keys';

describe('tenantKey', () => {
  it('produces non-overlapping keys for two different tenants', () => {
    const keyA = tenantKey('tenant-a', QUERY_KEYS.ORDERS);
    const keyB = tenantKey('tenant-b', QUERY_KEYS.ORDERS);
    expect(keyA).not.toEqual(keyB);
  });

  it('places the logical key first so devtools group-by-name still works', () => {
    const key = tenantKey('tenant-1', QUERY_KEYS.ORDERS);
    expect(key[0]).toBe(QUERY_KEYS.ORDERS);
    expect(key[1]).toBe('tenant-1');
  });

  it('substitutes the no-tenant sentinel when tenantId is null', () => {
    const key = tenantKey(null, QUERY_KEYS.TABLES);
    expect(key).toEqual([QUERY_KEYS.TABLES, NO_TENANT_KEY_SEGMENT]);
  });

  it('substitutes the no-tenant sentinel when tenantId is undefined', () => {
    const key = tenantKey(undefined, QUERY_KEYS.TABLES);
    expect(key).toEqual([QUERY_KEYS.TABLES, NO_TENANT_KEY_SEGMENT]);
  });

  it('appends extra segments after the tenant segment', () => {
    const key = tenantKey('tenant-1', QUERY_KEYS.ORDER, 'order-id-42');
    expect(key).toEqual([QUERY_KEYS.ORDER, 'tenant-1', 'order-id-42']);
  });

  it('preserves multiple extra segments in order', () => {
    const key = tenantKey('tenant-1', QUERY_KEYS.REPORTS, 'revenue', '2026-01-01', '2026-01-31');
    expect(key).toEqual([QUERY_KEYS.REPORTS, 'tenant-1', 'revenue', '2026-01-01', '2026-01-31']);
  });

  it('two tenants on the same logical key with the same suffix do not collide', () => {
    const keyA = tenantKey('tenant-a', QUERY_KEYS.ORDER, 'order-1');
    const keyB = tenantKey('tenant-b', QUERY_KEYS.ORDER, 'order-1');
    expect(keyA).not.toEqual(keyB);
    expect(keyA[2]).toBe(keyB[2]);
  });
});
