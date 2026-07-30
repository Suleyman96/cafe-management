import { handleSupabaseError } from '@gustri/api-client';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';
import { requirePlanAtLeast } from '@/lib/api/verify-plan';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

// Dedupe: not needed — UPDATE writes absolute settings values, so replays
// converge on the same row state and emit no audit/log side effects.

// Schema must list every field the cafe-settings form can send. Zod's
// default `.object()` strips unknown keys silently, so an omitted field
// here means the toggle / input appears to "save" (request 200s) but the
// value never reaches the DB. Field names and nullability mirror the
// `cafe_settings` table — see migrations/00000000000000_baseline.sql.
const UpdateSettingsSchema = z
  .object({
    // Restaurant
    restaurant_name: z.string().max(255),
    restaurant_address: z.string().nullable(),
    // Tax
    tax_enabled: z.boolean(),
    tax_percentage: z.number().min(0).max(100),
    tax_label: z.string().max(50),
    prices_include_tax: z.boolean(),
    show_tax_separately: z.boolean(),
    // Currency
    currency_symbol: z.string().max(10),
    currency_code: z.string().max(3),
    currency_position: z.enum(['before', 'after']),
    currency_decimal_places: z.number().int().min(0).max(4),
    // Ordering toggles
    minimum_order_amount: z.number().min(0),
    allow_item_notes: z.boolean(),
    allow_order_notes: z.boolean(),
    qr_ordering_enabled: z.boolean(),
    tips_enabled: z.boolean(),
    waste_tracking_enabled: z.boolean(),
    // Branding (gated to standard+ below)
    cafe_logo_url: z.string().nullable(),
    hero_image_url: z.string().nullable(),
    brand_primary_color: z.string().max(7),
    brand_secondary_color: z.string().max(7),
    welcome_heading: z.string().max(255).nullable(),
    welcome_message: z.string().nullable(),
    // Delivery
    delivery_enabled: z.boolean(),
    delivery_fee_default: z.number().min(0),
    minimum_delivery_amount: z.number().min(0),
    delivery_zone_info: z.string().nullable(),
    // Contact / socials
    contact_phone: z.string().max(20).nullable(),
    contact_website: z.string().nullable(),
    social_instagram: z.string().nullable(),
    social_whatsapp: z.string().nullable(),
    social_tiktok: z.string().nullable(),
    social_telegram: z.string().nullable(),
    social_line: z.string().nullable(),
    location_maps_url: z.string().nullable(),
    // Localization
    default_language: z.string().max(5),
    // First-run onboarding: set when the owner finishes the getting-started
    // checklist. Client sends an ISO timestamp; scoped to the caller's tenant.
    onboarding_completed_at: z.string().datetime().nullable(),
  })
  .partial();

const BRANDING_FIELDS = [
  'cafe_logo_url',
  'hero_image_url',
  'brand_primary_color',
  'brand_secondary_color',
  'welcome_heading',
  'welcome_message',
] as const satisfies readonly (keyof z.infer<typeof UpdateSettingsSchema>)[];

export async function PUT(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('staff', ip);
    if (!success) return jsonRateLimited(resetAt);

    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const { data, error } = await validateBody(request, UpdateSettingsSchema);
    if (error) return error;

    // Custom branding (logos, colors, welcome copy) is gated to `standard+`
    // per PLAN_LIMITS[*].customBranding. The rest of the settings payload
    // is open to all plans, so the check is scoped to whether the body
    // actually attempts to set any branding field rather than rejecting
    // the whole route for free-tier admins.
    const touchesBranding = BRANDING_FIELDS.some((f) => data[f] !== undefined);
    if (touchesBranding) {
      // requirePlanAtLeast throws AuthorizationError('plan_required') on
      // denial, NotFoundError('Tenant') on lookup miss. The outer
      // try/catch + handleRouteError below maps both to the right status
      // (403 / 404) and surfaces the sentinel — no inner catch needed.
      await requirePlanAtLeast(adminOrError.tenant_id, 'standard');
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
    return handleRouteError(err, request);
  }
}
