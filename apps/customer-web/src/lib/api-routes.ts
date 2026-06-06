import { httpStatusToAppError } from '@gustri/api-client';
import { RateLimitError } from '@gustri/core';
import type { Database } from '@gustri/database/types';
import { getOrCreateClientRequestId } from '@gustri/queries';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type WaiterCallRow = Database['public']['Tables']['waiter_calls']['Row'];
type CustomerFeedbackRow = Database['public']['Tables']['customer_feedback']['Row'];

// ADD-8 — customer mutations now post to customer-web's OWN same-origin BFF
// proxy (`app/api/v1/customer/[...path]`), which HMAC-signs the request
// server-side (where the secret is actually secret) and forwards it to
// staff-web. So the browser uses a relative, same-origin base; the proxy
// resolves the upstream staff-web URL server-side via
// `CUSTOMER_API_UPSTREAM_URL` / `NEXT_PUBLIC_API_BASE_URL`.
const API_BASE_URL = '';

/**
 * Client-side rate limiter to prevent rapid-fire API calls.
 * Tracks timestamps per endpoint and rejects calls that exceed the limit.
 */
const requestTimestamps: Map<string, number[]> = new Map();

function checkClientRateLimit(path: string, maxRequests: number, windowMs: number): void {
  const now = Date.now();
  const timestamps = requestTimestamps.get(path) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= maxRequests) {
    throw new RateLimitError();
  }

  recent.push(now);
  requestTimestamps.set(path, recent);
}

async function apiFetch<T>(path: string, init: RequestInit): Promise<T> {
  // Client-side throttle: max 5 POST requests per 30s per endpoint.
  // S5 — `checkClientRateLimit` already throws `RateLimitError` from
  // `@gustri/core`, which is an `AppError` subclass with `message =
  // 'rate_limited'`. The mutation cache's `isAppError(error)` check
  // localizes it via `localizeErrorMessage` → translated toast.
  if (init.method === 'POST') {
    checkClientRateLimit(path, 5, 30_000);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  // S5 — defensively parse: some error responses (or proxies) may not be
  // JSON. Falling back to an empty object keeps `httpStatusToAppError`
  // typed and lets it pick the right `AppError` subclass off the status
  // code alone.
  let body: { error?: string; details?: Record<string, unknown> } | null = null;
  try {
    body = (await res.json()) as { error?: string; details?: Record<string, unknown> };
  } catch {
    body = null;
  }

  if (!res.ok) {
    // S5 — emit a typed `AppError` so the mutation cache's
    // `isAppError(error)` branch in `providers.tsx` runs
    // `localizeErrorMessage(error.message, fallback)`. Pre-fix this
    // threw bare `new Error(body.error)` and customers saw raw sentinel
    // codes (`rate_limited`, `qr_token_revoked`, …) in toasts.
    throw httpStatusToAppError(res.status, body);
  }

  return body as T;
}

/**
 * Typed client for calling staff-web API routes.
 * Used for mutations that require server-side validation (plan limits, etc.).
 *
 * Tenant binding is derived server-side (C1). The client sends `table_id`
 * (dine_in) or `qr_token` (takeout/delivery) and the staff-web route
 * resolves the tenant from those — never from the request body.
 *
 * Idempotency (Blocker 1, pre-release audit): every mutation requires a
 * UUID v4 `client_request_id`. Hooks pre-stamp it in `onMutate` so React
 * Query retries reuse the same id and the server's
 * `(tenant_id, client_request_id)` partial-unique index dedupes the
 * second commit. The wrapper here also auto-stamps as a safety net for
 * any direct caller, but hook-level stamping is the primary contract —
 * a wrapper-only mint would generate a fresh id on every retry and
 * defeat the dedupe.
 */
type CreateCustomerOrderPayload =
  | {
      order_type: 'dine_in';
      table_id: string;
      source?: string;
      customer_notes?: string | null;
      client_request_id?: string;
    }
  | {
      order_type: 'takeout';
      qr_token: string;
      source?: string;
      customer_notes?: string | null;
      client_request_id?: string;
    }
  | {
      order_type: 'delivery';
      qr_token: string;
      source?: string;
      customer_notes?: string | null;
      delivery_address: string;
      delivery_phone: string;
      delivery_customer_name?: string | null;
      delivery_fee?: number | null;
      client_request_id?: string;
    };

type AddCustomerOrderItem = {
  menu_item_id: string;
  item_name: string;
  item_price: number;
  quantity: number;
  notes?: string | null;
  tenant_id: string;
  client_request_id?: string;
  selected_options?: Array<{ option_id: string; value_id: string }>;
};

type CreateWaiterCallPayload = {
  table_id: string;
  call_type: 'assistance' | 'bill' | 'complaint' | 'question' | 'emergency';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  reason?: string | null;
  notes?: string | null;
  client_request_id?: string;
};

type CreateFeedbackPayload = {
  table_id: string;
  order_id?: string | null;
  feedback_type: 'complaint' | 'praise';
  message: string;
  client_request_id?: string;
};

export const apiRoutes = {
  customerOrders: {
    create: (data: CreateCustomerOrderPayload) =>
      apiFetch<{ order: OrderRow }>('/api/v1/customer/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          client_request_id: getOrCreateClientRequestId(data.client_request_id),
        }),
      }),

    // M6/IDOR — `tableId` is sent so staff-web asserts it matches the order's
    // table_id for dine-in (the order UUID alone can't append items to a
    // stranger's open order). Null for delivery/takeout (no table).
    addItems: (orderId: string, items: AddCustomerOrderItem[], tableId?: string | null) =>
      apiFetch<{ items: OrderItemRow[] }>(`/api/v1/customer/orders/${orderId}/items`, {
        method: 'POST',
        body: JSON.stringify({
          table_id: tableId ?? null,
          items: items.map((item) => ({
            ...item,
            client_request_id: getOrCreateClientRequestId(item.client_request_id),
          })),
        }),
      }),

    // M6 — cancel through the API instead of direct-Supabase. Server
    // verifies `table_id` matches the order's table so a stranger who
    // scraped order_id can't cancel without also being at the same
    // table. Rate-limited (5/60s/IP).
    cancel: (orderId: string, data: { table_id: string; reason?: string | null }) =>
      apiFetch<{ order: OrderRow }>(`/api/v1/customer/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // C3 — per-item cancel through the API instead of direct-Supabase.
    // Pre-fix the customer-web hook called `db.orderItems.cancel()`,
    // which bypassed the Upstash limiter AND the M6 `table_id` match
    // check. Same `order-cancel` rate-limit bucket as the order-level
    // path (5/60s/IP) — cancellation is rare per legitimate session.
    cancelItem: (
      orderId: string,
      itemId: string,
      data: { table_id: string; cancel_qty?: number | null },
    ) =>
      apiFetch<{ item: OrderItemRow }>(
        `/api/v1/customer/orders/${orderId}/items/${itemId}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      ),
  },

  // H1 — both endpoints replace direct `db.waiterCalls.create` /
  // `db.feedback.create` calls so the Upstash limiter on the staff-web
  // edge gates them. Without this, the customer-web build is the only
  // throttle and a forked client (or a bare `curl`) bypasses it.
  customerWaiterCalls: {
    create: (data: CreateWaiterCallPayload) =>
      apiFetch<{ waiter_call: WaiterCallRow }>('/api/v1/customer/waiter-calls', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          client_request_id: getOrCreateClientRequestId(data.client_request_id),
        }),
      }),
  },

  customerFeedback: {
    create: (data: CreateFeedbackPayload) =>
      apiFetch<{ feedback: CustomerFeedbackRow }>('/api/v1/customer/feedback', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          client_request_id: getOrCreateClientRequestId(data.client_request_id),
        }),
      }),
  },

  // SSR-multi-tenant fix (plans/18 deferred). The /delivery/menu page
  // used to SSR-fetch from the anon Supabase client with no tenant
  // context bound, leaking mixed-tenant items into the SSR HTML in
  // multi-tenant deployments. Client now resolves the qr_token to a
  // tenant_id via this endpoint, then `db.setTenantContext(tenant_id)`
  // so subsequent wrapper reads (`useMenuItems`, `useCategories`) get
  // the `applyTenantScope` predicate the dine-in flow already enjoys.
  customerQrTokens: {
    resolve: (qrToken: string) =>
      apiFetch<{ tenant_id: string }>('/api/v1/customer/qr-tokens/resolve', {
        method: 'POST',
        body: JSON.stringify({ qr_token: qrToken }),
      }),
  },
};
