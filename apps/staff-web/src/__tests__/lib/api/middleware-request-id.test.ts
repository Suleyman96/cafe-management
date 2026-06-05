/**
 * Middleware correlation-ID behavior (ADD-9).
 *
 * Exercises the public-API branch (no Supabase auth needed): middleware must
 * stamp every /api/* response with an `x-request-id` header, honoring an
 * inbound one when supplied so an upstream caller's chain is preserved.
 */
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { REQUEST_ID_HEADER } from '@/lib/api/request-id';
import { middleware } from '@/middleware';

function apiRequest(path: string, headers?: Record<string, string>) {
  return new NextRequest(`http://localhost:3001${path}`, { headers });
}

describe('middleware x-request-id (ADD-9)', () => {
  it('stamps a fresh x-request-id on a public API response', async () => {
    const res = await middleware(apiRequest('/api/v1/health'));
    const id = res.headers.get(REQUEST_ID_HEADER);
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('echoes an inbound x-request-id unchanged (preserves the chain)', async () => {
    const res = await middleware(
      apiRequest('/api/v1/health', { [REQUEST_ID_HEADER]: 'upstream-xyz' }),
    );
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe('upstream-xyz');
  });
});
