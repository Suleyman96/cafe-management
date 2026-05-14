import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { verifyPlan } from '@/lib/api/verify-plan';
import { adjustStock } from '@/lib/services/stock-service';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

const AdjustStockSchema = z.object({
  movement_type: z.enum(['in', 'out', 'adjustment']),
  quantity_change: z.number().positive(),
  reason: z.string().optional(),
  performed_by: z.string().optional(),
  // Required (Blocker 1): stock adjustments mutate inventory and must
  // dedupe on replay so a retry doesn't double-deduct the count.
  client_request_id: z.string().uuid(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: stockItemId } = await params;

    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('staff', ip);
    if (!success) return jsonRateLimited(resetAt);

    // Inventory is a pro-tier feature. The mobile/web UIs hide stock
    // screens for free/standard tenants, but a modified client could call
    // this route directly — verifyPlan is the authoritative server check.
    const planContext = await verifyPlan(request, ['pro', 'business']);
    if (planContext instanceof NextResponse) return planContext;
    if (planContext instanceof Response) return planContext;

    const { data, error } = await validateBody(request, AdjustStockSchema);
    if (error) return error;

    const { stockItem, deduped } = await adjustStock(getSupabaseAdmin(), {
      stockItemId,
      data: {
        movement_type: data.movement_type,
        quantity_change: data.quantity_change,
        reason: data.reason || '',
        performed_by: data.performed_by || planContext.staff.id,
        client_request_id: data.client_request_id,
      },
      tenantId: planContext.staff.tenant_id,
    });

    return jsonOk({ stockItem }, deduped ? 200 : 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
