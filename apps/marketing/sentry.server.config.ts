import * as Sentry from '@sentry/nextjs';

// Server-side (Node) captures: SSR render throws and the /signup provisioning
// route. Marketing is a public site — the only PII in scope is a signup email,
// and `sendDefaultPii: false` (the default, set explicitly) keeps request
// bodies/headers off events, so no scrub layer is needed here (unlike
// staff-web/customer-web, which render customer PII).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});

Sentry.setTag('build_sha', process.env.NEXT_PUBLIC_BUILD_SHA ?? 'unknown');
