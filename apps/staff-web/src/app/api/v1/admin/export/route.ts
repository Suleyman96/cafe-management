import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonRateLimited } from '@/lib/api/response';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

// Bump when the payload shape changes so downstream importers can branch.
const EXPORT_FORMAT_VERSION = 1;

// GDPR data-portability (Art. 20): let a tenant admin download their entire
// dataset as machine-readable JSON. Every table here is tenant-scoped on a
// `tenant_id` column; the service role bypasses RLS, so the `.eq('tenant_id')`
// filter below is the ONLY thing keeping tenants isolated — it must never be
// dropped.
//
// `orders` is exported via its decrypted view (`orders_decrypted`), whose
// decrypt is unconditional, so the service role reads it fine. `delivery_
// customers` is handled SEPARATELY below (not in this list) because its
// decrypted view is role-gated on auth.uid() and returns NULL under the
// service role — see the delivery block in GET.
const TENANT_TABLES = [
  'cafe_settings',
  'categories',
  'menu_items',
  'menu_item_options',
  'menu_item_option_values',
  'tables',
  'staff',
  'staff_schedules',
  'staff_kitchen_filters',
  'orders_decrypted',
  'order_items',
  'order_payments',
  'refunds',
  'waiter_calls',
  'customer_feedback',
  'table_transfers',
  'stock_items',
  'stock_movements',
  'expense_categories',
  'expenses',
  'waste_logs',
  'tasks',
  'task_categories',
  'financial_audit_log',
] as const;

// Per-table column projection; default is '*'. `staff` MUST NOT export
// `pin_hash`: staff PINs are 4–6 digits, so the hash is trivially
// brute-forceable offline — a leaked export would hand over every staff
// member's PIN. Project an explicit safe column list instead (same spirit as
// excluding the token tables below).
const TABLE_COLUMNS: Partial<Record<(typeof TENANT_TABLES)[number], string>> = {
  staff:
    'id, tenant_id, email, full_name, phone, role, is_active, auth_user_id, last_login_at, pin_set_at, preferred_language, created_at, updated_at',
};

// Deliberately excluded — these carry live secrets, not business data, and
// belong in nobody's export:
//   qr_tokens          active table sign-in tokens (exporting = handing out keys)
//   staff_push_tokens  per-device push credentials
//   staff.pin_hash     redacted via TABLE_COLUMNS above (not a whole-table drop)
// `tenants` is exported separately below (keyed by `id`, not `tenant_id`).

export async function GET(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('data-export', ip);
    if (!success) return jsonRateLimited(resetAt);

    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const supabase = getSupabaseAdmin();
    const tenantId = adminOrError.tenant_id;

    // The tenant profile row lives in `tenants` keyed by `id` (no tenant_id).
    const tenantResult = await supabase.from('tenants').select('*').eq('id', tenantId).single();
    if (tenantResult.error) {
      // A verified admin whose tenant row is missing/unreadable is a
      // data-integrity fault, not a client error. Throw so handleRouteError
      // logs + pages Sentry and returns the standard generic 500 — better
      // than shipping a half-empty export that looks complete.
      throw new Error(`data-export: tenant row unreadable (${tenantResult.error.message})`);
    }

    const tableResults = await Promise.all(
      TENANT_TABLES.map(async (table) => ({
        table,
        ...(await supabase
          .from(table)
          .select(TABLE_COLUMNS[table] ?? '*')
          .eq('tenant_id', tenantId)),
      })),
    );

    const data: Record<string, unknown> = { tenants: tenantResult.data };
    const counts: Record<string, number> = { tenants: 1 };

    for (const { table, data: rows, error } of tableResults) {
      if (error) {
        // Fail the whole export on any table error — a partial dump silently
        // missing (say) order_payments is worse than a clear failure. Throw
        // for the standard logged/Sentry-reported 500.
        throw new Error(`data-export: table '${table}' failed (${error.message})`);
      }
      data[table] = rows ?? [];
      counts[table] = rows?.length ?? 0;
    }

    // delivery_customers holds an encrypted phone. Its decrypted view is
    // security_invoker + role-gated on get_my_staff_role() (which resolves via
    // auth.uid()), so a SERVICE-ROLE read returns NULL phones — the export
    // would silently omit the very PII it claims to include. Query it with a
    // USER-context client built from the caller's JWT (a verified admin/owner,
    // so their decrypt authority applies); RLS on the view scopes it to their
    // tenant, and we keep the explicit tenant filter as defense in depth.
    const token = request.headers.get('Authorization')?.slice(7) ?? '';
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const delivery = await userClient
      .from('delivery_customers_decrypted')
      .select('*')
      .eq('tenant_id', tenantId);
    if (delivery.error) {
      throw new Error(
        `data-export: delivery_customers_decrypted failed (${delivery.error.message})`,
      );
    }
    data.delivery_customers_decrypted = delivery.data ?? [];
    counts.delivery_customers_decrypted = delivery.data?.length ?? 0;

    const exportedAt = new Date().toISOString();
    const payload = {
      format_version: EXPORT_FORMAT_VERSION,
      exported_at: exportedAt,
      tenant_id: tenantId,
      counts,
      data,
    };

    const filename = `gustri-export-${tenantId}-${exportedAt.slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return handleRouteError(err, request);
  }
}
