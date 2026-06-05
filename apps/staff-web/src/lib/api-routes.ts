import type { Database } from '@gustri/database/types';
import { supabase } from '@/lib/supabase/client';

type OrderInsert = Database['public']['Tables']['orders']['Insert'];
type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderPaymentInsert = Database['public']['Tables']['order_payments']['Insert'];
type TableRow = Database['public']['Tables']['tables']['Row'];

/**
 * Get the current Supabase session token for Authorization header.
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  };
}

async function apiFetch<T>(url: string, init: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(url, { ...init, headers: { ...headers, ...init.headers } });
  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.error || `API error ${res.status}`);
  }

  return body as T;
}

/**
 * Typed client-side wrappers for server API routes.
 *
 * Money mutations (orders, payments, refunds, discounts, stock) require a
 * `client_request_id` (UUID v4). Hooks generate the id once per logical
 * user action in `onMutate` so React Query retries reuse it; the server's
 * `(tenant_id, client_request_id)` partial-unique index turns a retried
 * POST into a no-op that returns the original row instead of a duplicate
 * commit. See `apps/staff-web/src/lib/api/dedupe.ts` for the server side.
 */
export const apiRoutes = {
  orders: {
    create: (data: OrderInsert & { client_request_id: string }) =>
      apiFetch<{ order: OrderRow }>('/api/v1/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    assignWaiter: (orderId: string, waiterId: string | null) =>
      apiFetch<{ order: OrderRow }>(`/api/v1/orders/${orderId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ waiter_id: waiterId }),
      }),
  },

  discounts: {
    apply: (
      orderId: string,
      discount: {
        discount_type: 'none' | 'percentage' | 'fixed';
        discount_value: number;
        discount_reason?: string | null;
        discount_applied_by: string;
        client_request_id: string;
      },
    ) =>
      apiFetch<{ success: true; deduped?: boolean }>(`/api/v1/orders/${orderId}/discount`, {
        method: 'POST',
        body: JSON.stringify(discount),
      }),
  },

  payments: {
    create: (
      orderId: string,
      data: Omit<OrderPaymentInsert, 'order_id'> & { client_request_id: string },
    ) =>
      apiFetch<{ payment: Record<string, unknown> }>(`/api/v1/orders/${orderId}/payments`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  refunds: {
    create: (
      orderId: string,
      data: {
        amount: number;
        reason: string;
        refund_method: string;
        processed_by: string;
        order_item_ids?: string[] | null;
        notes?: string | null;
        client_request_id: string;
      },
    ) =>
      apiFetch<{ refund: Record<string, unknown> }>(`/api/v1/orders/${orderId}/refunds`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  stock: {
    adjust: (
      stockItemId: string,
      data: {
        movement_type: string;
        quantity_change: number;
        reason: string;
        performed_by: string;
        client_request_id: string;
      },
    ) =>
      apiFetch<{ stockItem: Record<string, unknown> }>(`/api/v1/stock/${stockItemId}/adjust`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  settings: {
    update: (data: Record<string, unknown>) =>
      apiFetch<{ settings: Record<string, unknown> }>('/api/v1/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  // H2 — admin-only QR rotation. Generates a fresh qr_code, refreshes
  // the expiry window, and clears any prior revoked_at. Old QR
  // stickers stop working as soon as the response lands.
  tables: {
    rotateQr: (tableId: string, opts?: { expires_at?: string | null }) =>
      apiFetch<{ table: TableRow }>(`/api/v1/admin/tables/${tableId}/rotate-qr`, {
        method: 'POST',
        body: JSON.stringify(opts ?? {}),
      }),
  },
};
