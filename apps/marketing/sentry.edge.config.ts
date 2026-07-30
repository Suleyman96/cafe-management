import * as Sentry from '@sentry/nextjs';

// Edge runtime (middleware / edge routes). Same minimal, PII-free config as the
// Node server entry.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
