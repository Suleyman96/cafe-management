import { httpStatusToAppError } from '@gustri/api-client';
import { AuthenticationError, NetworkError } from '@gustri/core';
import type {
  CafeSettings,
  CafeSettingsUpdateInput,
  Database,
  OrderPayment,
  Refund,
  StockItem,
} from '@gustri/database';
import Constants from 'expo-constants';
import { supabase } from './supabase';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderPaymentInsert = Database['public']['Tables']['order_payments']['Insert'];

const API_BASE_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL || '';

async function getAuthHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new AuthenticationError('No active session — please log in');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function parseJsonSafe(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function apiFetch<T>(path: string, init: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { ...headers, ...init.headers },
    });
  } catch (err) {
    throw new NetworkError(err instanceof Error ? err.message : 'Network request failed');
  }

  const body = await parseJsonSafe(res);

  if (!res.ok) {
    throw httpStatusToAppError(
      res.status,
      body as { error?: string; details?: Record<string, unknown> } | null,
      `API error ${res.status}`,
    );
  }

  return body as T;
}

/**
 * Variant of `apiFetch` that does NOT attach an Authorization header.
 * Used for the unauthenticated push-token revoke endpoint, which has to
 * succeed even when no user is logged in (offline-logout drain on next
 * boot) — see `pending-revokes.ts` for context.
 */
async function apiFetchUnauthed<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch (err) {
    throw new NetworkError(err instanceof Error ? err.message : 'Network request failed');
  }

  const body = await parseJsonSafe(res);

  if (!res.ok) {
    throw httpStatusToAppError(
      res.status,
      body as { error?: string; details?: Record<string, unknown> } | null,
      `API error ${res.status}`,
    );
  }

  return body as T;
}

/**
 * Typed client for calling staff-web API routes.
 * Used for mutations that require server-side validation.
 *
 * Mutating routes that mobile can replay offline REQUIRE a
 * `client_request_id` (UUID v4). The server uses it to dedupe replays via
 * the `(tenant_id, client_request_id)` partial-unique index, so a paused
 * mutation that committed but lost its response cannot create a duplicate
 * row when the persister rehydrates and retries it. Generate ids with
 * `getOrCreateClientRequestId` from `apps/mobile/src/lib/idempotency.ts`.
 *
 * Blocker 1 (pre-release audit): the field is now mandatory in the route
 * schemas — a missing key returns 400 instead of bypassing dedupe.
 */
export const apiRoutes = {
  orders: {
    create: (
      data: Database['public']['Tables']['orders']['Insert'] & { client_request_id: string },
    ) =>
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

  payments: {
    create: (
      orderId: string,
      data: Omit<OrderPaymentInsert, 'order_id'> & { client_request_id: string },
    ) =>
      apiFetch<{ payment: OrderPayment }>(`/api/v1/orders/${orderId}/payments`, {
        method: 'POST',
        body: JSON.stringify(data),
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

  refunds: {
    create: (
      orderId: string,
      data: {
        amount: number;
        reason: string;
        refund_method: string;
        order_item_ids?: string[] | null;
        notes?: string | null;
        client_request_id: string;
      },
    ) =>
      apiFetch<{ refund: Refund }>(`/api/v1/orders/${orderId}/refunds`, {
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
      apiFetch<{ stockItem: StockItem }>(`/api/v1/stock/${stockItemId}/adjust`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  settings: {
    update: (data: CafeSettingsUpdateInput) =>
      apiFetch<{ settings: CafeSettings }>('/api/v1/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  pushTokens: {
    register: (data: { expo_token: string; platform?: 'ios' | 'android' | null }) =>
      apiFetch<{
        token: {
          id: string;
          tenant_id: string;
          staff_id: string;
          expo_token: string;
          platform: string | null;
          last_seen_at: string;
        };
      }>('/api/v1/push-tokens/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    revoke: (data: { expo_token: string }) =>
      apiFetchUnauthed<{ revoked: true }>('/api/v1/push-tokens/revoke', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};
