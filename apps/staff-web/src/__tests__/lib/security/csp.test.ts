/**
 * CSP header construction (staff-web nonce-based policy).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCspHeader, CSP_NONCE_HEADER } from '@/lib/security/csp';

const NONCE = 'dGVzdC1ub25jZQ==';

describe('buildCspHeader', () => {
  // `vi.stubEnv` (not direct `process.env.X =`) — NODE_ENV is typed read-only,
  // so assigning it fails `tsc`; stubEnv also auto-restores via unstubAllEnvs.
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exposes the nonce header name', () => {
    expect(CSP_NONCE_HEADER).toBe('x-nonce');
  });

  it('puts the nonce and strict-dynamic in script-src, never unsafe-inline', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const csp = buildCspHeader(NONCE);
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src'));
    expect(scriptSrc).toContain(`'nonce-${NONCE}'`);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('allows unsafe-eval only in development (Webpack HMR)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(buildCspHeader(NONCE)).toContain("'unsafe-eval'");
    vi.stubEnv('NODE_ENV', 'production');
    expect(buildCspHeader(NONCE)).not.toContain("'unsafe-eval'");
  });

  it('includes the Supabase origin + realtime + Sentry in connect-src', () => {
    const csp = buildCspHeader(NONCE);
    const connectSrc = csp.split('; ').find((d) => d.startsWith('connect-src'));
    expect(connectSrc).toContain("'self'");
    expect(connectSrc).toContain('https://proj.supabase.co');
    expect(connectSrc).toContain('wss://*.supabase.co');
    expect(connectSrc).toContain('https://*.sentry.io');
  });

  it('filters out an unset Supabase URL rather than emitting stray whitespace', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    const csp = buildCspHeader(NONCE);
    const connectSrc = csp.split('; ').find((d) => d.startsWith('connect-src')) ?? '';
    expect(connectSrc).not.toMatch(/connect-src\s{2,}/);
    expect(connectSrc).not.toContain('  ');
  });

  it('locks frame-ancestors to none and base-uri/form-action to self', () => {
    const csp = buildCspHeader(NONCE);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });
});
