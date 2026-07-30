/**
 * Regression guard for the financial-actor hardening: the actor written to the
 * payment / financial-audit / stock-movement trail MUST come from the verified
 * JWT, never a body-supplied id. Each test POSTs a FORGED actor id in the body
 * and asserts the service receives the caller's verified id instead.
 *
 * Covers all four routes touched by the hardening:
 *   payments  received_by         (verifyStaff)
 *   refunds   processed_by        (verifyAdmin)
 *   discount  discount_applied_by (verifyAdmin)
 *   stock     performed_by        (verifyPlan)
 */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyStaffMock = vi.fn();
vi.mock('@/lib/api/verify-staff', () => ({
  verifyStaff: (...a: unknown[]) => verifyStaffMock(...a),
}));

const verifyAdminMock = vi.fn();
vi.mock('@/lib/api/verify-admin', () => ({
  verifyAdmin: (...a: unknown[]) => verifyAdminMock(...a),
  getSupabaseAdmin: () => ({}),
}));

const verifyPlanMock = vi.fn();
vi.mock('@/lib/api/verify-plan', () => ({
  verifyPlan: (...a: unknown[]) => verifyPlanMock(...a),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 999, resetAt: 0 }),
  getRateLimitIdentifier: () => '127.0.0.1',
}));

const createPaymentMock = vi.fn();
vi.mock('@/lib/services/payment-service', () => ({
  createPayment: (...a: unknown[]) => createPaymentMock(...a),
}));
const createRefundMock = vi.fn();
vi.mock('@/lib/services/refund-service', () => ({
  createRefund: (...a: unknown[]) => createRefundMock(...a),
}));
const applyDiscountMock = vi.fn();
vi.mock('@/lib/services/discount-service', () => ({
  applyDiscount: (...a: unknown[]) => applyDiscountMock(...a),
}));
const adjustStockMock = vi.fn();
vi.mock('@/lib/services/stock-service', () => ({
  adjustStock: (...a: unknown[]) => adjustStockMock(...a),
}));

const { POST: paymentsPOST } = await import('@/app/api/v1/orders/[id]/payments/route');
const { POST: refundsPOST } = await import('@/app/api/v1/orders/[id]/refunds/route');
const { POST: discountPOST } = await import('@/app/api/v1/orders/[id]/discount/route');
const { POST: stockPOST } = await import('@/app/api/v1/stock/[id]/adjust/route');

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const STOCK_ID = '55555555-5555-4555-8555-555555555555';
const CRID = '44444444-4444-4444-8444-444444444444';
// The verified caller vs. the spoof a malicious client stuffs in the body.
const JWT_ACTOR = '33333333-3333-4333-8333-333333333333';
const FORGED = '99999999-9999-4999-8999-999999999999';

function buildRequest(body: Record<string, unknown>): NextRequest {
  return { headers: { get: () => null }, json: async () => body } as unknown as NextRequest;
}
const orderParams = Promise.resolve({ id: ORDER_ID });
const stockParams = Promise.resolve({ id: STOCK_ID });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('financial actor attribution — body-supplied actor is ignored', () => {
  it('payments: received_by comes from verifyStaff, not the body', async () => {
    verifyStaffMock.mockResolvedValue({ id: JWT_ACTOR, role: 'waiter', tenant_id: TENANT });
    createPaymentMock.mockResolvedValue({ payment: { id: 'p1' }, deduped: false });

    const res = await paymentsPOST(
      buildRequest({
        amount: 50,
        payment_method: 'cash',
        payment_type: 'full',
        received_by: FORGED,
        client_request_id: CRID,
      }),
      { params: orderParams },
    );

    expect(res.status).toBe(201);
    const arg = createPaymentMock.mock.calls[0]![1] as { paymentData: { received_by: string } };
    expect(arg.paymentData.received_by).toBe(JWT_ACTOR);
    expect(arg.paymentData.received_by).not.toBe(FORGED);
  });

  it('refunds: processed_by comes from verifyAdmin, not the body', async () => {
    verifyAdminMock.mockResolvedValue({ id: JWT_ACTOR, role: 'admin', tenant_id: TENANT });
    createRefundMock.mockResolvedValue({ refund: { id: 'r1' }, deduped: false });

    const res = await refundsPOST(
      buildRequest({
        amount: 20,
        reason: 'spillage',
        refund_method: 'cash',
        processed_by: FORGED,
        client_request_id: CRID,
      }),
      { params: orderParams },
    );

    expect(res.status).toBe(201);
    const arg = createRefundMock.mock.calls[0]![1] as { refundData: { processed_by: string } };
    expect(arg.refundData.processed_by).toBe(JWT_ACTOR);
    expect(arg.refundData.processed_by).not.toBe(FORGED);
  });

  it('discount: discount_applied_by comes from verifyAdmin, not the body', async () => {
    verifyAdminMock.mockResolvedValue({ id: JWT_ACTOR, role: 'admin', tenant_id: TENANT });
    applyDiscountMock.mockResolvedValue({ order: { id: ORDER_ID }, deduped: false });

    const res = await discountPOST(
      buildRequest({
        discount_type: 'percentage',
        discount_value: 10,
        discount_applied_by: FORGED,
        client_request_id: CRID,
      }),
      { params: orderParams },
    );

    expect(res.status).toBe(200);
    const arg = applyDiscountMock.mock.calls[0]![1] as { discountAppliedBy: string };
    expect(arg.discountAppliedBy).toBe(JWT_ACTOR);
    expect(arg.discountAppliedBy).not.toBe(FORGED);
  });

  it('stock: performed_by comes from verifyPlan, not the body', async () => {
    verifyPlanMock.mockResolvedValue({ staff: { id: JWT_ACTOR, tenant_id: TENANT } });
    adjustStockMock.mockResolvedValue({ stockItem: { id: 's1' }, deduped: false });

    const res = await stockPOST(
      buildRequest({
        movement_type: 'adjustment',
        quantity_change: 5,
        performed_by: FORGED,
        client_request_id: CRID,
      }),
      { params: stockParams },
    );

    expect(res.status).toBe(201);
    const arg = adjustStockMock.mock.calls[0]![1] as { data: { performed_by: string } };
    expect(arg.data.performed_by).toBe(JWT_ACTOR);
    expect(arg.data.performed_by).not.toBe(FORGED);
  });
});
