// Server-side push-notification dispatch (Blocker: send-push invocation wiring).
//
// The `send-push` edge function is deployed but nothing invoked it, so push
// never fired. This fans a notification out to a tenant's active staff when a
// new order or waiter call is created. Called from the order + engagement
// services, gated on `!deduped` (a retried/idempotent POST doesn't re-push).
//
// Design notes:
//  - The edge function renders the OS notification from `title`/`body`, so a
//    backgrounded device shows them as-is. We therefore render server-side in
//    the TENANT's `default_language` (a cafe shares one language). `data.type`
//    lets the mobile app route/relocalize in the foreground.
//  - Best-effort + failure-isolated: a push failure must never fail or slow the
//    write it follows. We await with a short timeout (there is no Vercel
//    `waitUntil` in this project, so un-awaited work isn't guaranteed to run)
//    and swallow every error.
//  - Follow-ups (documented, not built here): role targeting (kitchen for
//    orders, waiters for calls — the edge fn currently fans to all active
//    staff), and letting the edge fn return before awaiting Expo.

import staffEn from '@gustri/i18n/locales/en/staff.json';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/api/logger';

const PUSH_TIMEOUT_MS = 2000;

// Role targeting. Owner + admin are always included as a safety net so a
// single manager/owner working a shift never misses an alert, even in a cafe
// with no dedicated kitchen/waiter staff.
const ORDER_ROLES = ['kitchen', 'owner', 'admin'];
const WAITER_CALL_ROLES = ['waiter', 'owner', 'admin'];

// We read the locale JSON directly and interpolate by hand rather than going
// through `@gustri/i18n` (react-i18next) — this module is imported by API
// routes, and pulling React's context into that server bundle breaks the Next
// build. The KEYS still live in the i18n locale files (the source of truth); we
// only need a react-free lookup of 4 flat keys with `{{number}}` interpolation.
type Bundle = Record<string, string>;

// Lazy per-locale loaders for the `staff` namespace (en is bundled eagerly as
// the fallback; the other 19 load on first use for a tenant on that locale).
const staffLoaders: Record<string, () => Promise<Bundle>> = {
  en: () => Promise.resolve(staffEn as Bundle),
  ar: () => import('@gustri/i18n/locales/ar/staff.json').then((m) => m.default as Bundle),
  az: () => import('@gustri/i18n/locales/az/staff.json').then((m) => m.default as Bundle),
  de: () => import('@gustri/i18n/locales/de/staff.json').then((m) => m.default as Bundle),
  el: () => import('@gustri/i18n/locales/el/staff.json').then((m) => m.default as Bundle),
  es: () => import('@gustri/i18n/locales/es/staff.json').then((m) => m.default as Bundle),
  fa: () => import('@gustri/i18n/locales/fa/staff.json').then((m) => m.default as Bundle),
  fr: () => import('@gustri/i18n/locales/fr/staff.json').then((m) => m.default as Bundle),
  id: () => import('@gustri/i18n/locales/id/staff.json').then((m) => m.default as Bundle),
  it: () => import('@gustri/i18n/locales/it/staff.json').then((m) => m.default as Bundle),
  ja: () => import('@gustri/i18n/locales/ja/staff.json').then((m) => m.default as Bundle),
  ka: () => import('@gustri/i18n/locales/ka/staff.json').then((m) => m.default as Bundle),
  kk: () => import('@gustri/i18n/locales/kk/staff.json').then((m) => m.default as Bundle),
  ko: () => import('@gustri/i18n/locales/ko/staff.json').then((m) => m.default as Bundle),
  pt: () => import('@gustri/i18n/locales/pt/staff.json').then((m) => m.default as Bundle),
  ru: () => import('@gustri/i18n/locales/ru/staff.json').then((m) => m.default as Bundle),
  th: () => import('@gustri/i18n/locales/th/staff.json').then((m) => m.default as Bundle),
  tr: () => import('@gustri/i18n/locales/tr/staff.json').then((m) => m.default as Bundle),
  uk: () => import('@gustri/i18n/locales/uk/staff.json').then((m) => m.default as Bundle),
  uz: () => import('@gustri/i18n/locales/uz/staff.json').then((m) => m.default as Bundle),
};

const bundleCache = new Map<string, Bundle>([['en', staffEn as Bundle]]);

async function loadBundle(locale: string): Promise<Bundle> {
  const lang = staffLoaders[locale] ? locale : 'en';
  const cached = bundleCache.get(lang);
  if (cached) return cached;
  const loader = staffLoaders[lang];
  if (!loader) return staffEn as Bundle;
  const bundle = await loader();
  bundleCache.set(lang, bundle);
  return bundle;
}

function interpolate(template: string, params?: Record<string, unknown>): string {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) =>
    params[name] != null ? String(params[name]) : '',
  );
}

/**
 * Render a `staff`-namespace key for a specific locale, falling back to `en`
 * for a missing locale or key. React-free (see the file header). Never throws —
 * returns the key on failure.
 */
async function renderPush(
  locale: string,
  key: string,
  params?: Record<string, unknown>,
): Promise<string> {
  try {
    const bundle = await loadBundle(locale);
    const template = bundle[key] ?? (staffEn as Bundle)[key];
    return template ? interpolate(template, params) : key;
  } catch {
    return key;
  }
}

async function tenantLocale(admin: SupabaseClient, tenantId: string): Promise<string> {
  const { data } = await admin
    .from('cafe_settings')
    .select('default_language')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return ((data as { default_language?: string } | null)?.default_language || 'en').toLowerCase();
}

/**
 * Invoke the `send-push` edge function for a tenant. Awaited with a timeout so
 * a slow/failed push can't hang the write it follows; every error is swallowed.
 */
async function sendTenantPush(
  admin: SupabaseClient,
  payload: {
    tenantId: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    roles?: string[];
  },
): Promise<void> {
  try {
    const invoke = admin.functions.invoke('send-push', {
      body: {
        tenant_id: payload.tenantId,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        // Restrict recipients by role when given; owner/admin are always
        // included by the caller so a solo owner-on-shift still gets buzzed.
        ...(payload.roles ? { roles: payload.roles } : {}),
      },
    });
    const timeout = new Promise<{ error: { message: string } }>((resolve) =>
      setTimeout(() => resolve({ error: { message: 'push invoke timed out' } }), PUSH_TIMEOUT_MS),
    );
    const res = await Promise.race([invoke, timeout]);
    if (res && 'error' in res && res.error) {
      logger.warn('push_send_failed', { tenant_id: payload.tenantId, error: res.error.message });
    }
  } catch (err) {
    logger.warn('push_send_failed', {
      tenant_id: payload.tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Push staff when a new order lands. Never throws. */
export async function notifyNewOrder(
  admin: SupabaseClient,
  args: { tenantId: string; orderNumber?: string | number | null },
): Promise<void> {
  try {
    const locale = await tenantLocale(admin, args.tenantId);
    const number = args.orderNumber != null ? String(args.orderNumber) : '';
    const [title, body] = await Promise.all([
      renderPush(locale, 'push.newOrder.title'),
      renderPush(locale, 'push.newOrder.body', { number }),
    ]);
    await sendTenantPush(admin, {
      tenantId: args.tenantId,
      title,
      body,
      data: { type: 'new_order' },
      roles: ORDER_ROLES,
    });
  } catch (err) {
    logger.warn('push_notify_order_failed', {
      tenant_id: args.tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Push staff when a customer buzzes for a waiter. Never throws. */
export async function notifyNewWaiterCall(
  admin: SupabaseClient,
  args: { tenantId: string; tableId?: string | null },
): Promise<void> {
  try {
    const locale = await tenantLocale(admin, args.tenantId);
    const [title, body] = await Promise.all([
      renderPush(locale, 'push.newWaiterCall.title'),
      renderPush(locale, 'push.newWaiterCall.body'),
    ]);
    await sendTenantPush(admin, {
      tenantId: args.tenantId,
      title,
      body,
      data: { type: 'waiter_call', tableId: args.tableId ?? null },
      roles: WAITER_CALL_ROLES,
    });
  } catch (err) {
    logger.warn('push_notify_waiter_call_failed', {
      tenant_id: args.tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
