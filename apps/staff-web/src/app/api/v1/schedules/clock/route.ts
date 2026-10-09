import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonRateLimited } from '@/lib/api/response';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { verifyStaff } from '@/lib/api/verify-staff';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

/**
 * POST /api/schedules/clock
 * Handles clock-in (start shift) and clock-out (end shift) for any staff member.
 * Body: { scheduleId: string, action: 'clock_in' | 'clock_out' }
 *
 * Dedupe: not needed — the state-machine guards (`status !== 'scheduled'` for
 * clock_in, `status !== 'in_progress'` for clock_out) reject replays after
 * the first commit with a 400. A replayed clock_in lands on a row already in
 * `in_progress`/`completed` and short-circuits.
 */
export async function POST(request: NextRequest) {
  try {
    // L4: bound automated abuse of the clock endpoint.
    const { success, resetAt } = await rateLimit('shift-op', getRateLimitIdentifier(request));
    if (!success) return jsonRateLimited(resetAt);

    const staffOrError = await verifyStaff(request);
    if (staffOrError instanceof NextResponse) return staffOrError;

    const body = await request.json();
    const { scheduleId, action } = body;

    if (!scheduleId || !['clock_in', 'clock_out'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid request: scheduleId and action (clock_in|clock_out) required' },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Fetch the schedule and verify it belongs to the requesting staff member
    const { data: schedule, error: fetchError } = await supabaseAdmin
      .from('staff_schedules')
      .select('*')
      .eq('id', scheduleId)
      .eq('tenant_id', staffOrError.tenant_id)
      .single();

    if (fetchError || !schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // Staff can only clock their own schedules (admins/owners can clock any)
    if (schedule.staff_id !== staffOrError.id && !['admin', 'owner'].includes(staffOrError.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date().toISOString();

    if (action === 'clock_in') {
      if (schedule.status !== 'scheduled') {
        return NextResponse.json(
          { error: 'Can only clock in to a scheduled shift' },
          { status: 400 },
        );
      }

      const { data, error } = await supabaseAdmin
        .from('staff_schedules')
        .update({ status: 'in_progress', actual_start: now })
        .eq('id', scheduleId)
        .select()
        .single();

      if (error) {
        Sentry.captureException(error);
        return NextResponse.json({ error: 'Failed to clock in' }, { status: 500 });
      }

      return NextResponse.json({ schedule: data });
    }

    // clock_out
    if (schedule.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Can only clock out of an in-progress shift' },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from('staff_schedules')
      .update({ status: 'completed', actual_end: now })
      .eq('id', scheduleId)
      .select()
      .single();

    if (error) {
      Sentry.captureException(error);
      return NextResponse.json({ error: 'Failed to clock out' }, { status: 500 });
    }

    return NextResponse.json({ schedule: data });
  } catch (err) {
    return handleRouteError(err, request);
  }
}
