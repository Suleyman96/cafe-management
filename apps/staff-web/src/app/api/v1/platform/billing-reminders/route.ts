import { BILLING_REMINDER_DAYS, billingNeedsAttention } from '@gustri/core';
import { type NextRequest, NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { logger } from '@/lib/api/logger';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { isAuthorizedCron } from '@/lib/api/verify-cron-secret';
import { verifyPlatformAdmin } from '@/lib/api/verify-platform-admin';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

/**
 * POST /api/v1/platform/billing-reminders — renewal-reminder sweep.
 *
 * Finds PAID tenants whose paid-through date (`current_period_end`) is within
 * BILLING_REMINDER_DAYS or already overdue, and emails the operator
 * (PLATFORM_ADMIN_EMAILS) a digest so a manual-billing renewal doesn't slip.
 * The in-console banner (platform/page.tsx) is the PRIMARY reminder; this is
 * the last-mile email backup.
 *
 * DORMANT UNTIL EMAIL IS WIRED: there is no ESP in the app yet. When the email
 * transport (`RESEND_API_KEY`) or recipients (`PLATFORM_ADMIN_EMAILS`) are
 * unset, the sweep computes the due list, logs a summary, and returns
 * `{ emailed: false, reason }` — it never errors. Once the key + a verified
 * sender are configured it starts emailing with no code change.
 *
 * Auth mirrors the data-retention endpoint: the GitHub Actions cron uses the
 * `x-cron-secret` shared secret; a platform admin can also run it one-shot from
 * a session. When the cron secret is unset, `isAuthorizedCron` is false and the
 * endpoint stays platform-admin-only (safe default).
 */
export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedCron(request)) {
      const adminOrError = await verifyPlatformAdmin(request);
      if (adminOrError instanceof NextResponse) return adminOrError;
    }

    const supabase = getSupabaseAdmin();

    // Only paid tenants carry a renewal date; free tenants have NULL. We pull
    // active paid tenants with a non-null date and filter in JS via the shared
    // core helper so the "within N days / overdue" rule matches the console.
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, plan, billing_email, billing_cycle, current_period_end')
      .neq('plan', 'free')
      .eq('is_active', true)
      .not('current_period_end', 'is', null);

    if (error) {
      throw new Error(`platform billing-reminders: query failed (${error.message})`);
    }

    const now = new Date();
    const due = (data ?? [])
      .filter((t) => billingNeedsAttention(t.current_period_end, now, BILLING_REMINDER_DAYS))
      .map((t) => ({
        id: t.id,
        name: t.name,
        plan: t.plan,
        billing_cycle: t.billing_cycle,
        current_period_end: t.current_period_end,
      }));

    // Recipients + transport. Both must be configured or we no-op (dormant).
    const recipients = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    const espKey = process.env.RESEND_API_KEY;

    if (due.length === 0) {
      logger.info('billing-reminders: no tenants due', {
        route: '/api/v1/platform/billing-reminders',
        due: 0,
      });
      return NextResponse.json({
        status: 'completed',
        due: [],
        emailed: false,
        reason: 'none_due',
      });
    }

    if (!espKey || recipients.length === 0) {
      // Dormant path: surface the due list in the log (and response) so the
      // operator still has a signal via the cron run output + the console banner.
      logger.warn('billing-reminders: email not configured — skipping send', {
        route: '/api/v1/platform/billing-reminders',
        due: due.length,
        has_esp: Boolean(espKey),
        has_recipients: recipients.length > 0,
      });
      return NextResponse.json({
        status: 'completed',
        due,
        emailed: false,
        reason: 'email_not_configured',
      });
    }

    // Email transport is configured — send the digest. Any transport failure is
    // caught so a flaky ESP never fails the cron (it retries tomorrow; the
    // banner covers the gap).
    const lines = due
      .map((t) => `• ${t.name} (${t.plan}, ${t.billing_cycle ?? '—'}) — ${t.current_period_end}`)
      .join('\n');
    const emailed = await sendOperatorDigest(espKey, recipients, due.length, lines);

    return NextResponse.json({ status: 'completed', due, emailed });
  } catch (err) {
    return handleRouteError(err, request);
  }
}

/**
 * Send the renewal digest via the Resend HTTP API. Returns whether the send
 * succeeded; never throws (a transport error is logged and swallowed so the
 * sweep stays green). `from` requires a verified sender — until one is set via
 * `BILLING_REMINDER_FROM` we fall back to Resend's onboarding sender, which only
 * delivers to the account owner (acceptable for an operator-only digest).
 */
async function sendOperatorDigest(
  apiKey: string,
  recipients: string[],
  count: number,
  body: string,
): Promise<boolean> {
  try {
    const from = process.env.BILLING_REMINDER_FROM || 'onboarding@resend.dev';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: `[gustri] ${count} tenant renewal(s) need attention`,
        text: `The following paid tenants are expiring soon or overdue:\n\n${body}\n\nReview them in the platform console.`,
      }),
    });
    if (!res.ok) {
      logger.error('billing-reminders: ESP send failed', {
        route: '/api/v1/platform/billing-reminders',
        status: res.status,
      });
      return false;
    }
    logger.info('billing-reminders: digest sent', {
      route: '/api/v1/platform/billing-reminders',
      recipients: recipients.length,
      due: count,
    });
    return true;
  } catch (err) {
    logger.error('billing-reminders: ESP send threw', {
      route: '/api/v1/platform/billing-reminders',
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
