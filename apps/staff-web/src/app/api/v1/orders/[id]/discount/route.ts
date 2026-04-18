import { DiscountTypeSchema } from '@gustri/database';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { verifyStaff } from '@/lib/api/verify-staff';
import { applyDiscount } from '@/lib/services/discount-service';

export const dynamic = 'force-dynamic';

const ApplyDiscountSchema = z.object({
  discount_type: DiscountTypeSchema,
  discount_value: z.number().min(0),
  discount_reason: z.string().optional().nullable(),
  discount_applied_by: z.string().uuid(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await params;

    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('discount', ip);
    if (!success) return jsonRateLimited(resetAt);

    const staffOrError = await verifyStaff(request);
    if (staffOrError instanceof NextResponse) return staffOrError;

    const { data, error } = await validateBody(request, ApplyDiscountSchema);
    if (error) return error;

    await applyDiscount(getSupabaseAdmin(), {
      orderId,
      discountType: data.discount_type,
      discountValue: data.discount_value,
      discountReason: data.discount_reason,
      discountAppliedBy: data.discount_applied_by,
      tenantId: staffOrError.tenant_id,
    });

    return jsonOk({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
