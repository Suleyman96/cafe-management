import { scrubSentryEvent } from '@gustri/core';
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  // Edge runtime (middleware) shares the scrub with the browser and Node
  // server entries so a single denylist covers every event path out of
  // staff-web.
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
});
