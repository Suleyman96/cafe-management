import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from '@/lib/sentry-scrub';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  // S5 — edge runtime (middleware) shares the scrub with the browser
  // and Node server entries so a single denylist covers every event
  // path out of customer-web.
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
});
