import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { verifyPin } from '@/lib/api/pin-hash';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonError, jsonOk, jsonRateLimited } from '@/lib/api/response';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { verifyStaff } from '@/lib/api/verify-staff';

// Plan 13 — verify a PIN to clear the idle soft-lock. Tightly rate-limited
// (5 attempts per 5 min per IP) so an attacker who gains physical access to
// a tablet can't brute-force a 4-digit PIN online. The per-staff verify
// always reads the freshest hash so a rotated PIN takes effect immediately.

const VerifyPinSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, 'PIN must be 4-8 digits'),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('staff-pin-verify', ip);
    if (!success) return jsonRateLimited(resetAt);

    const staffOrError = await verifyStaff(request);
    if (staffOrError instanceof NextResponse) return staffOrError;

    const body = await request.json();
    const parsed = VerifyPinSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Validation failed', 400, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: row, error } = await supabaseAdmin
      .from('staff')
      .select('pin_hash')
      .eq('id', staffOrError.id)
      .eq('tenant_id', staffOrError.tenant_id)
      .single();

    if (error || !row) return jsonError('Staff not found', 404);
    // No PIN set means the soft-lock should not have engaged; clients
    // gate the prompt on `pin_set_at`, but answer truthfully here so a
    // misuse fails closed rather than silently letting the user past.
    if (!row.pin_hash) return jsonError('pin_not_set', 400);

    if (!verifyPin(parsed.data.pin, row.pin_hash)) {
      return jsonError('pin_invalid', 401);
    }

    return jsonOk({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
