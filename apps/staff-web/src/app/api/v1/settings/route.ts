import { handleSupabaseError } from '@gustri/api-client';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonError, jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';
import { requirePlanAtLeast } from '@/lib/api/verify-plan';

export const dynamic = 'force-dynamic';

// Dedupe: not needed — UPDATE writes absolute settings values, so replays
// converge on the same row state and emit no audit/log side effects.

const UpdateSettingsSchema = z
  .object({
    restaurant_name: z.string().optional(),
    restaurant_address: z.string().optional().nullable(),
    restaurant_phone: z.string().optional().nullable(),
    restaurant_email: z.string().email().optional().nullable(),
    currency_symbol: z.string().optional(),
    currency_position: z.enum(['before', 'after']).optional(),
    currency_decimal_places: z.number().int().min(0).max(4).optional(),
    tax_enabled: z.boolean().optional(),
    tax_percentage: z.number().min(0).max(100).optional(),
    prices_include_tax: z.boolean().optional(),
    delivery_enabled: z.boolean().optional(),
    delivery_fee_default: z.number().min(0).optional(),
    minimum_delivery_amount: z.number().min(0).optional(),
    minimum_order_amount: z.number().min(0).optional(),
    default_language: z.string().optional(),
    brand_primary_color: z.string().optional(),
    brand_logo_url: z.string().optional().nullable(),
    feature_flags: z.record(z.string(), z.boolean()).optional(),
  })
  .partial();

export async function PUT(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('staff', ip);
    if (!success) return jsonRateLimited(resetAt);

    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const { data, error } = await validateBody(request, UpdateSettingsSchema);
    if (error) return error;

    // Custom branding (logo + primary color) is gated to `standard+` per
    // PLAN_LIMITS[*].customBranding. The rest of the settings payload is
    // open to all plans, so check is scoped to whether the body actually
    // attempts to set those fields rather than rejecting the whole route
    // for free-tier admins.
    const touchesBranding =
      data.brand_primary_color !== undefined || data.brand_logo_url !== undefined;
    if (touchesBranding) {
      try {
        await requirePlanAtLeast(adminOrError.tenant_id, 'standard');
      } catch {
        return jsonError('plan_required', 403);
      }
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: settings, error: updateError } = await supabaseAdmin
      .from('cafe_settings')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('tenant_id', adminOrError.tenant_id)
      .select()
      .single();

    if (updateError) throw handleSupabaseError(updateError);

    return jsonOk({ settings });
  } catch (err) {
    return handleRouteError(err);
  }
}
