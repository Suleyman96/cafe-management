import { scrubSentryEvent } from '@gustri/core';
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  // S5 — server-side captures (SSR errors, middleware throws) flow
  // through the same scrub as the browser. customer-web's server
  // surface is mostly read-only (SSR menu, middleware redirects), but
  // any future server-action that touches a delivery body would
  // otherwise reach Sentry uncrubbed.
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
});

// Match the browser bootstrap so server-thrown exceptions also carry build_sha.
Sentry.setTag('build_sha', process.env.NEXT_PUBLIC_BUILD_SHA ?? 'unknown');
