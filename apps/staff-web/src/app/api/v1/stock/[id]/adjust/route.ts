import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { verifyStaff } from '@/lib/api/verify-staff';
import { adjustStock } from '@/lib/services/stock-service';

export const dynamic = 'force-dynamic';

const AdjustStockSchema = z.object({
  movement_type: z.enum(['in', 'out', 'adjustment']),
  quantity_change: z.number().positive(),
  reason: z.string().min(1),
  performed_by: z.string().uuid(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: stockItemId } = await params;

    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('staff', ip);
    if (!success) return jsonRateLimited(resetAt);

    const staffOrError = await verifyStaff(request);
    if (staffOrError instanceof NextResponse) return staffOrError;

    const { data, error } = await validateBody(request, AdjustStockSchema);
    if (error) return error;

    const stockItem = await adjustStock(getSupabaseAdmin(), {
      stockItemId,
      data,
      tenantId: staffOrError.tenant_id,
    });

    return jsonOk({ stockItem });
  } catch (err) {
    return handleRouteError(err);
  }
}
