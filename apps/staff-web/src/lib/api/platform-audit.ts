import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';

/**
 * L12 — record a platform-operator (super-admin) mutation in
 * `platform_audit_log` (migration 20261010000002).
 *
 * Operator actions (tenant create, plan change, status change) span tenants and
 * have no order, so they don't fit `financial_audit_log`. This writes a
 * dedicated, cross-tenant audit row via the service-role client (the table's
 * RLS denies all tenant users; the operator reads/writes through the
 * `verifyPlatformAdmin` gate, which bypasses RLS).
 *
 * Best-effort: a failed audit insert is logged but never fails the operator
 * action itself (the mutation already committed). Audit loss is surfaced in the
 * structured logs rather than stranding a live tenant on a half-applied change.
 */
export type PlatformAuditAction = 'tenant_create' | 'plan_change' | 'status_change';

export async function logPlatformAudit(
  supabase: SupabaseClient,
  entry: {
    actorId: string | null;
    actorEmail: string;
    tenantId: string | null;
    action: PlatformAuditAction;
    oldValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    reason?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from('platform_audit_log').insert({
    actor_id: entry.actorId,
    actor_email: entry.actorEmail,
    tenant_id: entry.tenantId,
    action: entry.action,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
    reason: entry.reason ?? null,
  });

  if (error) {
    logger.error('platform-audit: insert failed', {
      action: entry.action,
      tenant_id: entry.tenantId,
      actor_email: entry.actorEmail,
      error: error.message,
    });
  }
}
