import { describe, expect, it } from 'vitest';
import { getRequestId, newRequestId, REQUEST_ID_HEADER } from '@/lib/api/request-id';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('request-id (ADD-9)', () => {
  it('newRequestId mints a v4-shaped UUID', () => {
    expect(newRequestId()).toMatch(UUID_RE);
  });

  it('mints distinct IDs', () => {
    expect(newRequestId()).not.toBe(newRequestId());
  });

  it('getRequestId returns the inbound x-request-id header when present', () => {
    const req = { headers: new Headers({ [REQUEST_ID_HEADER]: 'upstream-123' }) };
    expect(getRequestId(req)).toBe('upstream-123');
  });

  it('getRequestId mints a fresh UUID when the header is absent', () => {
    const req = { headers: new Headers() };
    expect(getRequestId(req)).toMatch(UUID_RE);
  });
});
