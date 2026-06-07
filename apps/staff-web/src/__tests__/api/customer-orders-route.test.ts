/**
 * Route-level test for `/api/v1/customer/orders` (C1).
 *
 * The discriminated-union schema in route.ts is the front line for the
 * tenant-spoofing fix:
 *  - takeout/delivery payloads MUST carry `qr_token` (else 400)
 *  - dine_in payloads MUST carry `table_id` (else 400)
 *  - any extra body field — including a spoofed `tenant_id` — is dropped
 *    by zod's discriminated union and never reaches the service.
 *
 * The service-level mock isolates the route from the Supabase wrapper so
 * we exercise validation + the request → service plumbing only.
 */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/verify-admin', () => ({
  getSupabaseAdmin: () => ({}),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 999, resetAt: 0 }),
  getRateLimitIdentifier: () => '127.0.0.1',
}));

const createCustomerOrderMock = vi.fn();
vi.mock('@/lib/services/customer-order-service', () => ({
  createCustomerOrder: (...args: unknown[]) => createCustomerOrderMock(...args),
}));

const { POST } = await import('@/app/api/v1/customer/orders/route');

function buildRequest(body: Record<string, unknown>): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as unknown as NextRequest;
}

beforeEach(() => {
  createCustomerOrderMock.mockReset();
});

describe('POST /api/v1/customer/orders — schema gate (C1)', () => {
  it('rejects takeout payload that supplies tenant_id but no qr_token', async () => {
    // The exact attacker payload from the C1 finding. The discriminated
    // union demands `qr_token` for takeout — `tenant_id` in the body is
    // not a recognized discriminator field and gets dropped.
    const res = await POST(
      buildRequest({
        order_type: 'takeout',
        tenant_id: '99999999-9999-4999-8999-999999999999',
      }),
    );

    expect(res.status).toBe(400);
    expect(createCustomerOrderMock).not.toHaveBeenCalled();
  });

  it('rejects delivery payload missing qr_token', async () => {
    const res = await POST(
      buildRequest({
        order_type: 'delivery',
        delivery_address: '1 Main St',
        delivery_phone: '+15551234567',
      }),
    );

    expect(res.status).toBe(400);
    expect(createCustomerOrderMock).not.toHaveBeenCalled();
  });

  it('rejects dine_in payload missing table_id', async () => {
    const res = await POST(
      buildRequest({
        order_type: 'dine_in',
      }),
    );

    expect(res.status).toBe(400);
    expect(createCustomerOrderMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown order_type', async () => {
    const res = await POST(
      buildRequest({
        order_type: 'pickup',
        qr_token: 'tkn_x',
      }),
    );

    expect(res.status).toBe(400);
    expect(createCustomerOrderMock).not.toHaveBeenCalled();
  });

  it('forwards a valid takeout payload to the service WITHOUT tenant_id', async () => {
    createCustomerOrderMock.mockResolvedValue({
      order: { id: 'o1', tenant_id: 'derived-tenant' },
      deduped: false,
    });

    // Attacker-shaped body: includes `tenant_id` alongside the legitimate
    // `qr_token`. The schema strips unknown keys — the service receives
    // only the union members. `client_request_id` is now required (Blocker 1).
    const res = await POST(
      buildRequest({
        order_type: 'takeout',
        qr_token: 'tkn_legit',
        tenant_id: '99999999-9999-4999-8999-999999999999',
        client_request_id: '55555555-5555-4555-8555-555555555555',
      }),
    );

    expect(res.status).toBe(201);
    expect(createCustomerOrderMock).toHaveBeenCalledTimes(1);
    const callArg = createCustomerOrderMock.mock.calls[0]![1] as {
      orderData: Record<string, unknown>;
    };
    expect(callArg.orderData).not.toHaveProperty('tenant_id');
    expect(callArg.orderData.qr_token).toBe('tkn_legit');
    expect(callArg.orderData.client_request_id).toBe('55555555-5555-4555-8555-555555555555');
  });

  it('rejects a valid-looking takeout payload that omits client_request_id (Blocker 1)', async () => {
    const res = await POST(
      buildRequest({
        order_type: 'takeout',
        qr_token: 'tkn_legit',
      }),
    );

    expect(res.status).toBe(400);
    expect(createCustomerOrderMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/customer/orders — length caps (H3)', () => {
  // Each test asserts the route rejects an oversized free-text payload at
  // the schema gate, before the service layer is touched. The Postgres
  // CHECK constraints in 20260507000001 are the second line of defense
  // for direct-Supabase paths that bypass this route — they're tested
  // separately at the wrapper layer.

  it('rejects dine_in with customer_notes exceeding 2000 chars', async () => {
    const res = await POST(
      buildRequest({
        order_type: 'dine_in',
        table_id: '11111111-1111-4111-8111-111111111111',
        client_request_id: '55555555-5555-4555-8555-555555555555',
        customer_notes: 'x'.repeat(2001),
      }),
    );

    expect(res.status).toBe(400);
    expect(createCustomerOrderMock).not.toHaveBeenCalled();
  });

  it('rejects delivery with delivery_address exceeding 500 chars', async () => {
    const res = await POST(
      buildRequest({
        order_type: 'delivery',
        qr_token: 'tkn_legit',
        client_request_id: '55555555-5555-4555-8555-555555555555',
        delivery_address: 'x'.repeat(501),
        delivery_phone: '+15551234567',
      }),
    );

    expect(res.status).toBe(400);
    expect(createCustomerOrderMock).not.toHaveBeenCalled();
  });

  it('rejects delivery with delivery_customer_name exceeding 100 chars', async () => {
    const res = await POST(
      buildRequest({
        order_type: 'delivery',
        qr_token: 'tkn_legit',
        client_request_id: '55555555-5555-4555-8555-555555555555',
        delivery_address: '1 Main St',
        delivery_phone: '+15551234567',
        delivery_customer_name: 'x'.repeat(101),
      }),
    );

    expect(res.status).toBe(400);
    expect(createCustomerOrderMock).not.toHaveBeenCalled();
  });

  // Audit fix — pre-PR the schema used `/^[+\d\s\-()]{7,20}$/` which
  // accepted shape-valid but uncallable inputs like `+()()()()` or strings
  // of pure spaces/hyphens. The shared `isValidPhone` helper now requires
  // ≥ MIN_PHONE_DIGITS real digits; the route should reject these even
  // though they pass the prior character-set bound.
  it.each([
    ['parens-only zero-digit garbage', '+()()()()'],
    ['hyphens only', '------- '],
    ['signs and spaces, no digits', '+( )(  )'],
  ])('rejects delivery with phone %s as 400 (audit fix)', async (_label, phone) => {
    const res = await POST(
      buildRequest({
        order_type: 'delivery',
        qr_token: 'tkn_legit',
        client_request_id: '55555555-5555-4555-8555-555555555555',
        delivery_address: '1 Main St',
        delivery_phone: phone,
      }),
    );

    expect(res.status).toBe(400);
    expect(createCustomerOrderMock).not.toHaveBeenCalled();
  });

  it('accepts dine_in with customer_notes exactly at the 2000-char cap', async () => {
    createCustomerOrderMock.mockResolvedValue({
      order: { id: 'o1', tenant_id: 'derived-tenant' },
      deduped: false,
    });

    const res = await POST(
      buildRequest({
        order_type: 'dine_in',
        table_id: '11111111-1111-4111-8111-111111111111',
        client_request_id: '55555555-5555-4555-8555-555555555555',
        customer_notes: 'x'.repeat(2000),
      }),
    );

    expect(res.status).toBe(201);
    expect(createCustomerOrderMock).toHaveBeenCalledTimes(1);
  });
});
