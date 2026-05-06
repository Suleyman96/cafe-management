import { randomUUID } from 'node:crypto';
import { NotFoundError } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Rotate the QR code for a single table within a tenant (H2).
 *
 * The rotation flow:
 *   1. Generate a fresh `crypto.randomUUID()` value (122 bits of
 *      entropy — same shape as the existing baseline QR codes).
 *   2. Atomically update the row: new `qr_code`, fresh
 *      `qr_code_expires_at` (passed by the caller; default 1 year if
 *      omitted), clear `qr_code_revoked_at`, stamp
 *      `qr_code_rotated_at = now()`.
 *   3. Return the updated row so the admin UI can render the new QR
 *      for printing.
 *
 * Tenant-scoped: the UPDATE filters by both `id` AND `tenant_id` so
 * an admin from tenant A can't accidentally (or maliciously) rotate
 * tenant B's table even with a service-role client. `verifyAdmin` in
 * the route layer is the first gate; this filter is defense in depth.
 *
 * The previous `qr_code` value is overwritten, so any customer holding
 * the old code gets `invalid_qr_token` from `set_table_context` on the
 * next scan (the row no longer matches that qr_code value). We
 * deliberately do NOT preserve the old code as a "revoked" alias —
 * that would expand the attack surface (two valid-looking codes per
 * row) for negligible UX win.
 */
export async function rotateTableQrCode(
  supabaseAdmin: SupabaseClient,
  args: {
    tableId: string;
    tenantId: string;
    expiresAt?: Date | null;
  },
) {
  const { tableId, tenantId, expiresAt } = args;

  // Default expiry: 1 year out. Operators can pass null to disable
  // auto-expiry on the rotated code, or pass an explicit Date for a
  // tighter window. The migration's column default is NULL so no
  // existing row is auto-expired without an explicit rotation.
  const newExpiresAt =
    expiresAt === null ? null : (expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));

  const { data, error } = await supabaseAdmin
    .from('tables')
    .update({
      qr_code: randomUUID(),
      qr_code_expires_at: newExpiresAt?.toISOString() ?? null,
      qr_code_revoked_at: null,
      qr_code_rotated_at: new Date().toISOString(),
    })
    .eq('id', tableId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    // Postgres returns PGRST116 ("no rows returned") when the
    // (id, tenant_id) pair doesn't match — either the table doesn't
    // exist or it belongs to another tenant. Both surface as 404 to
    // the caller; we don't reveal which.
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new NotFoundError('Table');
    }
    throw new Error(error.message);
  }

  return data;
}
