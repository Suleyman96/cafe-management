// Sentry browser bootstrap. Renamed from `sentry.client.config.ts`
// (the legacy filename Sentry deprecated and Turbopack will not load
// — see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client).
import { scrubPiiFields, scrubSentryEvent, scrubTokenFromUrl } from '@gustri/core';
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    // PII fix — staff-web is the app with the *most* PII: order/table/payment
    // screens render customer names, phones, delivery addresses, and order
    // notes as body text, and every form (orders, discounts, refunds, staff
    // CRUD) is full of inputs. Session-replay would otherwise capture all of
    // it verbatim. We mask BOTH inputs and rendered text (stricter than
    // customer-web, which keeps text visible because it renders little PII) —
    // replays still capture DOM structure, layout, clicks, and navigation, so
    // the flow remains reproducible without exposing any PII.
    Sentry.replayIntegration({ maskAllInputs: true, maskAllText: true }),
  ],
  // Two layers of redaction before events leave the browser, shared with
  // customer-web via the headless `@gustri/core` scrub primitive:
  //   1. URL scrub — strip bearer tokens from `?`/`#` forms in
  //      `event.request.url` and breadcrumb `data.url`.
  //   2. PII key scrub — replace `customer_name`/`customer_phone`/
  //      `delivery_address`/`notes`/… with `[REDACTED]` wherever they appear
  //      in `request.data`, breadcrumb data, contexts/extra/tags.
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
  beforeBreadcrumb(crumb) {
    const data = crumb?.data;
    if (!data) return crumb;
    const next: Record<string, unknown> = { ...data };
    if (typeof next.url === 'string') {
      next.url = scrubTokenFromUrl(next.url);
    }
    return { ...crumb, data: scrubPiiFields(next) };
  },
});

// Stamp build_sha on every event so Sentry issues group by deploy.
// Set after init so it sticks on the global scope. Tenant/user tags
// are set in RealtimeAuthBridge (apps/staff-web/src/app/providers.tsx)
// because those depend on auth state, not boot state.
Sentry.setTag('build_sha', process.env.NEXT_PUBLIC_BUILD_SHA ?? 'unknown');
