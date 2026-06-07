/**
 * ADD-8 — customer-web BFF proxy route (`app/api/v1/customer/[...path]`).
 *
 * Verifies it forwards to the configured upstream, signs server-side when the
 * secret is set, forwards the real client IP, and mirrors the upstream
 * status/body + correlation header.
 */
import {
  computeRequestSignature,
  NONCE_HEADER,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
} from '@gustri/core';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// UPSTREAM is captured at module load — set it before importing the route.
process.env.NEXT_PUBLIC_API_BASE_URL = 'http://staff.test';
const { POST } = await import('@/app/api/v1/customer/[...path]/route');

function proxyRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/v1/customer/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
}

function upstreamOk(bodyObj: unknown, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(bodyObj), {
    status: 201,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  });
}

const originalSecret = process.env.CUSTOMER_API_SIGNING_SECRET;
afterEach(() => {
  if (originalSecret === undefined) delete process.env.CUSTOMER_API_SIGNING_SECRET;
  else process.env.CUSTOMER_API_SIGNING_SECRET = originalSecret;
  vi.restoreAllMocks();
});

describe('customer BFF proxy', () => {
  it('forwards to the upstream customer path and mirrors status + body', async () => {
    delete process.env.CUSTOMER_API_SIGNING_SECRET;
    const fetchMock = vi.fn().mockResolvedValue(upstreamOk({ order: { id: 'o1' } }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST(proxyRequest('{"table_id":"t1"}'), {
      params: Promise.resolve({ path: ['orders'] }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // calls[0] is provably present after the toHaveBeenCalledTimes(1) above.
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://staff.test/api/v1/customer/orders');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"table_id":"t1"}');

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ order: { id: 'o1' } });
  });

  it('does NOT sign when the secret is unset (dev / pre-rollout)', async () => {
    delete process.env.CUSTOMER_API_SIGNING_SECRET;
    const fetchMock = vi.fn().mockResolvedValue(upstreamOk({}));
    vi.stubGlobal('fetch', fetchMock);

    await POST(proxyRequest('{}'), { params: Promise.resolve({ path: ['orders'] }) });

    const headers = fetchMock.mock.calls[0]![1].headers as Record<string, string>;
    expect(headers[SIGNATURE_HEADER]).toBeUndefined();
    expect(headers[TIMESTAMP_HEADER]).toBeUndefined();
  });

  it('signs server-side with a verifiable HMAC when the secret is set', async () => {
    process.env.CUSTOMER_API_SIGNING_SECRET = 'proxy-secret';
    const fetchMock = vi.fn().mockResolvedValue(upstreamOk({}));
    vi.stubGlobal('fetch', fetchMock);

    const body = '{"table_id":"t1"}';
    await POST(proxyRequest(body), { params: Promise.resolve({ path: ['orders'] }) });

    const headers = fetchMock.mock.calls[0]![1].headers as Record<string, string>;
    // Asserted to match /^\d+$/ below, so present.
    const timestamp = headers[TIMESTAMP_HEADER]!;
    const nonce = headers[NONCE_HEADER];
    expect(timestamp).toMatch(/^\d+$/);
    expect(nonce).toMatch(/^[0-9a-f-]{36}$/i); // a minted UUID
    // Recompute with the same inputs (including the nonce) the proxy used.
    const expected = await computeRequestSignature({
      secret: 'proxy-secret',
      timestamp,
      method: 'POST',
      path: '/api/v1/customer/orders',
      body,
      nonce,
    });
    expect(headers[SIGNATURE_HEADER]).toBe(expected);
  });

  it('forwards the real client IP so staff-web rate-limits per customer', async () => {
    delete process.env.CUSTOMER_API_SIGNING_SECRET;
    const fetchMock = vi.fn().mockResolvedValue(upstreamOk({}));
    vi.stubGlobal('fetch', fetchMock);

    await POST(proxyRequest('{}', { 'x-real-ip': '203.0.113.7' }), {
      params: Promise.resolve({ path: ['orders'] }),
    });

    const headers = fetchMock.mock.calls[0]![1].headers as Record<string, string>;
    expect(headers['x-real-ip']).toBe('203.0.113.7');
  });

  it('propagates the x-request-id correlation header from the upstream response', async () => {
    delete process.env.CUSTOMER_API_SIGNING_SECRET;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(upstreamOk({}, { 'x-request-id': 'rid-xyz' })),
    );

    const res = await POST(proxyRequest('{}'), {
      params: Promise.resolve({ path: ['orders'] }),
    });
    expect(res.headers.get('x-request-id')).toBe('rid-xyz');
  });

  it('builds the upstream path from nested catch-all segments', async () => {
    delete process.env.CUSTOMER_API_SIGNING_SECRET;
    const fetchMock = vi.fn().mockResolvedValue(upstreamOk({}));
    vi.stubGlobal('fetch', fetchMock);

    await POST(proxyRequest('{}'), {
      params: Promise.resolve({ path: ['orders', 'o1', 'cancel'] }),
    });
    expect(fetchMock.mock.calls[0]![0]).toBe('http://staff.test/api/v1/customer/orders/o1/cancel');
  });
});
