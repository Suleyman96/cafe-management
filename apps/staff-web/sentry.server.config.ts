import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
});

// Match the client-side bootstrap so server-thrown exceptions also carry
// build_sha — important for deploy-correlated regressions.
Sentry.setTag('build_sha', process.env.NEXT_PUBLIC_BUILD_SHA ?? 'unknown');
