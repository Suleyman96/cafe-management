import { handleSupabaseError } from '@gustri/api-client';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { jsonOk } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

/**
 * Reassign (or unassign) the waiter on an order. Admin/owner only.
 *
 * Pre-fix this was a direct wrapper write (`db.orders.assignWaiter`); RLS
 * lets any active staff update the row, which means a waiter could pull
 * another waiter's open order off them mid-shift. The route restricts
 * the operation to admin/owner and uses the service-role client so the
 * bound JWT cannot widen the scope. Tenant isolation is checked at the
 * boundary by querying `tenant_id` and comparing against the verified
 * admin's tenant.
 *
 * Dedupe: not needed — this is an idempotent UPDATE that writes an absolute
 * value (`assigned_waiter_id`). Replaying the same payload yields the same
 * row state and emits no audit/log side effects.
 */

const AssignWaiterSchema = z.object({
  waiter_id: z.string().uuid().nullable(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await params;

    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const { data, error } = await validateBody(request, AssignWaiterSchema);
    if (error) return error;

    const supabaseAdmin = getSupabaseAdmin();

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ assigned_waiter_id: data.waiter_id })
      .eq('id', orderId)
      .eq('tenant_id', adminOrError.tenant_id)
      .select()
      .single();

    if (updateError) throw handleSupabaseError(updateError);

    return jsonOk({ order: updated });
  } catch (err) {
    return handleRouteError(err, request);
  }
}
