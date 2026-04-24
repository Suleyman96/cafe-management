import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('run_data_retention');

    if (error) {
      return NextResponse.json({ error: 'Retention failed' }, { status: 500 });
    }

    return NextResponse.json({ status: 'completed', results: data });
  } catch (err) {
    return handleRouteError(err);
  }
}
