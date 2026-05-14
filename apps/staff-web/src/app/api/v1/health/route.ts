import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';

/**
 * Liveness + readiness endpoint for external uptime monitors, deploy
 * verifiers, and the in-app version-skew detector.
 *
 * Unauthenticated by design — uptime monitors can't carry credentials, and
 * the response carries only health booleans + the build SHA. No tenant
 * data, no DSN echo, no env values. The build SHA is already exposed via
 * `NEXT_PUBLIC_BUILD_SHA` (it's burned into every client bundle), so
 * surfacing it here adds no information.
 *
 * Probes:
 *   - `db`     : minimal SELECT against `cafe_settings` using the service
 *                role client — tests that Postgres is reachable AND that
 *                the service-role key is valid. A failed probe returns
 *                503 with `db.ok=false`.
 *   - `redis`  : Upstash REST `GET /ping`. Skipped (omitted from the
 *                response) when `UPSTASH_REDIS_REST_URL` isn't set, so
 *                local/dev runs don't fail readiness on a missing
 *                Upstash. In production the instrumentation boot guard
 *                refuses to start without it, so the env var is always
 *                present and the probe always runs.
 *
 * Response shape:
 *   { ok, sha, ts, latency_ms, checks: { db, redis? } }
 *
 * Status code:
 *   200 — every present check returned ok
 *   503 — at least one present check failed
 *
 * `dynamic = 'force-dynamic'` prevents Next from caching the response;
 * stale 200s would defeat the whole purpose of a liveness probe.
 */

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];
export const runtime = 'nodejs';

interface CheckResult {
  ok: boolean;
  ms?: number;
  error?: string;
}

const REDIS_PROBE_TIMEOUT_MS = 2_000;

async function checkDb(): Promise<CheckResult> {
  const t = Date.now();
  try {
    const { error } = await getSupabaseAdmin().from('cafe_settings').select('id').limit(1);
    if (error) return { ok: false, error: error.message };
    return { ok: true, ms: Date.now() - t };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function checkRedis(): Promise<CheckResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const t = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REDIS_PROBE_TIMEOUT_MS);
  try {
    const r = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    return { ok: true, ms: Date.now() - t };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const t0 = Date.now();
  const [db, redis] = await Promise.all([checkDb(), checkRedis()]);

  const checks: Record<string, CheckResult> = { db };
  if (redis !== null) checks.redis = redis;

  const ok = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      ok,
      sha: process.env.NEXT_PUBLIC_BUILD_SHA ?? 'unknown',
      ts: new Date().toISOString(),
      latency_ms: Date.now() - t0,
      checks,
    },
    { status: ok ? 200 : 503 },
  );
}
