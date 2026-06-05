import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { jsonOk } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';
import { rotateTableQrCode } from '@/lib/services/table-qr-service';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

// `expires_at` is optional. Omit for the service default (1 year).
// Pass `null` to disable auto-expiry. Pass an ISO datetime for a custom
// window. The route does NOT accept a `tenant_id` field — it's derived
// from the verified admin's JWT to prevent cross-tenant rotation even
// if the URL param was tampered with.
const RotateQrSchema = z.object({
  expires_at: z.union([z.string().datetime(), z.null()]).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const { id: tableId } = await params;

    const { data, error } = await validateBody(request, RotateQrSchema);
    if (error) return error;

    const expiresAt =
      data.expires_at === undefined
        ? undefined
        : data.expires_at === null
          ? null
          : new Date(data.expires_at);

    const updated = await rotateTableQrCode(getSupabaseAdmin(), {
      tableId,
      tenantId: adminOrError.tenant_id,
      expiresAt,
    });

    return jsonOk({ table: updated });
  } catch (err) {
    return handleRouteError(err, request);
  }
}
