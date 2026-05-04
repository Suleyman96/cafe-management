// Sentry browser bootstrap. Renamed from `sentry.client.config.ts`
// (the legacy filename Sentry deprecated and Turbopack will not load
// — see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client).
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
});

// Stamp build_sha on every event so Sentry issues group by deploy.
// Set after init so it sticks on the global scope. Tenant/user tags
// are set in RealtimeAuthBridge (apps/staff-web/src/app/providers.tsx)
// because those depend on auth state, not boot state.
Sentry.setTag('build_sha', process.env.NEXT_PUBLIC_BUILD_SHA ?? 'unknown');
