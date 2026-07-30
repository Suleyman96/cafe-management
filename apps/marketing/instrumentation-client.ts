// Sentry browser bootstrap. Renamed from `sentry.client.config.ts` per the
// Next.js client-instrumentation convention. No session replay: the marketing
// site renders no sensitive session worth reconstructing, and skipping it keeps
// the public bundle lean.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});

Sentry.setTag('build_sha', process.env.NEXT_PUBLIC_BUILD_SHA ?? 'unknown');

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
