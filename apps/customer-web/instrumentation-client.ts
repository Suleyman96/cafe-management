// Sentry browser bootstrap. Renamed from `sentry.client.config.ts`
// (the legacy filename Sentry deprecated and Turbopack will not load
// — see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client).
import * as Sentry from '@sentry/nextjs';
import { scrubTokenFromUrl } from '@/lib/sentry-scrub';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  // Replay sample rates. Pre-PR `replaysOnErrorSampleRate: 1.0` recorded
  // every error replay; for an anon customer app that's mostly transient
  // network blips and validation toasts, the signal density is low
  // enough that 10% gives sufficient coverage to spot real regressions
  // without burning quota. Sessions stay off entirely (`0`) — we only
  // want replays attached to actual error events.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,
  integrations: [
    // PII fix — replays would otherwise capture the customer's name,
    // phone, address, and order/cart-item notes verbatim because the
    // delivery landing form, table-landing language picker, and cart
    // screens are full of inputs. `maskAllInputs: true` redacts every
    // <input>, <textarea>, <select>; `maskAllText: false` keeps body
    // text visible (menu items, prices, table number) so replays remain
    // useful for diagnosing the actual UI flow without exposing what
    // the customer typed.
    Sentry.replayIntegration({ maskAllInputs: true, maskAllText: false }),
  ],
  // Strip bearer `qr_token`/`access_token` from URLs before they ship.
  // The token reaches Sentry primarily via navigation breadcrumbs after
  // a QR scan — `?token=…` (legacy share-link form) and `#token=…`
  // (fragment form, plan 17 M1) are both scrubbed. `beforeSend` covers
  // the top-level `event.request.url`; `beforeBreadcrumb` covers each
  // navigation breadcrumb at capture time so by the time the event
  // ships, breadcrumbs are already clean. Inlined here (rather than
  // delegating to a typed helper) because Sentry's `ErrorEvent` type
  // has narrower `request` shape than `Record<string, unknown>`; the
  // pure scrubbing primitive lives in `lib/sentry-scrub.ts` for unit
  // testing.
  beforeSend(event) {
    if (typeof event.request?.url === 'string') {
      event.request.url = scrubTokenFromUrl(event.request.url);
    }
    if (Array.isArray(event.breadcrumbs)) {
      for (const crumb of event.breadcrumbs) {
        if (typeof crumb.data?.url === 'string') {
          crumb.data.url = scrubTokenFromUrl(crumb.data.url);
        }
      }
    }
    return event;
  },
  beforeBreadcrumb(crumb) {
    if (typeof crumb?.data?.url === 'string') {
      return { ...crumb, data: { ...crumb.data, url: scrubTokenFromUrl(crumb.data.url) } };
    }
    return crumb;
  },
});
