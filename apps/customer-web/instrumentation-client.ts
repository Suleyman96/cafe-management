// Sentry browser bootstrap. Renamed from `sentry.client.config.ts`
// (the legacy filename Sentry deprecated and Turbopack will not load
// — see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client).
import * as Sentry from '@sentry/nextjs';
import { scrubPiiFields, scrubSentryEvent, scrubTokenFromUrl } from '@/lib/sentry-scrub';

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
  // S5 — Two layers of redaction before events leave the browser:
  //
  //   1. URL scrub. `qr_token`/`access_token`/`token` are stripped from
  //      `?` and `#` forms in `event.request.url` and every
  //      breadcrumb's `data.url`. The token reaches Sentry primarily
  //      via navigation breadcrumbs after a QR scan.
  //
  //   2. PII key scrub. Mutation request bodies for
  //      `/api/v1/customer/orders` (delivery) carry `customer_name`,
  //      `customer_phone`, `delivery_address`, … — if Sentry's SDK
  //      attaches them via `request.data`, breadcrumb fetch data, or
  //      any custom `extra`/`tags`/`contexts` payload at a capture
  //      site, they're replaced with `[REDACTED]` field-by-field.
  //
  // The pure scrubbing primitive lives in `lib/sentry-scrub.ts` for
  // unit testing; this file just wires it into the Sentry lifecycle.
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
