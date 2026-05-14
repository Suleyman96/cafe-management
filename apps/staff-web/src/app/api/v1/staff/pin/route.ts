import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { hashPin, verifyPin } from '@/lib/api/pin-hash';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonError, jsonOk, jsonRateLimited } from '@/lib/api/response';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { verifyStaff } from '@/lib/api/verify-staff';

// Plan 13 — set or change the PIN used by the idle soft-lock. Self-service:
// any active staff may set their own PIN. If a PIN is already set, the
// caller must supply the current one to rotate it. Hashing happens server-
// side via crypto.scryptSync (see pin-hash.ts).

const SetPinSchema = z.object({
  newPin: z.string().regex(/^\d{4,8}$/, 'PIN must be 4-8 digits'),
  currentPin: z
    .string()
    .regex(/^\d{4,8}$/)
    .optional(),
});

const ClearPinSchema = z.object({
  currentPin: z.string().regex(/^\d{4,8}$/),
});

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

export async function POST(request: NextRequest) {
  try {
    // Rate-limited like other auth-adjacent endpoints. Reuses the
    // password-reset bucket — same threat model (online guessing).
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('password-reset', ip);
    if (!success) return jsonRateLimited(resetAt);

    const staffOrError = await verifyStaff(request);
    if (staffOrError instanceof NextResponse) return staffOrError;

    const body = await request.json();
    const parsed = SetPinSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Validation failed', 400, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }
    const { newPin, currentPin } = parsed.data;

    const supabaseAdmin = getSupabaseAdmin();

    // Read the existing hash to decide whether the caller must prove they
    // know the current PIN before rotating it. Service role bypasses RLS.
    const { data: row, error: readErr } = await supabaseAdmin
      .from('staff')
      .select('id, pin_hash')
      .eq('id', staffOrError.id)
      .eq('tenant_id', staffOrError.tenant_id)
      .single();

    if (readErr || !row) {
      return jsonError('Staff not found', 404);
    }

    if (row.pin_hash) {
      if (!currentPin) return jsonError('current_pin_required', 400);
      if (!verifyPin(currentPin, row.pin_hash)) {
        return jsonError('current_pin_invalid', 401);
      }
    }

    const hash = hashPin(newPin);
    const { error: updateErr } = await supabaseAdmin
      .from('staff')
      .update({ pin_hash: hash, pin_set_at: new Date().toISOString() })
      .eq('id', staffOrError.id)
      .eq('tenant_id', staffOrError.tenant_id);

    if (updateErr) return jsonError('Failed to set PIN', 500);

    return jsonOk({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('password-reset', ip);
    if (!success) return jsonRateLimited(resetAt);

    const staffOrError = await verifyStaff(request);
    if (staffOrError instanceof NextResponse) return staffOrError;

    const body = await request.json();
    const parsed = ClearPinSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Validation failed', 400, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: row, error: readErr } = await supabaseAdmin
      .from('staff')
      .select('pin_hash')
      .eq('id', staffOrError.id)
      .eq('tenant_id', staffOrError.tenant_id)
      .single();

    if (readErr || !row) return jsonError('Staff not found', 404);
    if (!row.pin_hash) return jsonError('pin_not_set', 400);
    if (!verifyPin(parsed.data.currentPin, row.pin_hash)) {
      return jsonError('current_pin_invalid', 401);
    }

    const { error: updateErr } = await supabaseAdmin
      .from('staff')
      .update({ pin_hash: null, pin_set_at: null })
      .eq('id', staffOrError.id)
      .eq('tenant_id', staffOrError.tenant_id);

    if (updateErr) return jsonError('Failed to clear PIN', 500);
    return jsonOk({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
