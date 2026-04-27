import { AuthenticationError, httpStatusToAppError, NetworkError } from '@gustri/core';
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
 * Typed client for calling staff-web API routes.
 * Used for mutations that require server-side validation.
 */
export const apiRoutes = {
  orders: {
    create: (data: Database['public']['Tables']['orders']['Insert']) =>
      apiFetch<{ order: OrderRow }>('/api/v1/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  payments: {
    create: (orderId: string, data: Omit<OrderPaymentInsert, 'order_id'>) =>
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
      },
    ) =>
      apiFetch<{ success: true }>(`/api/v1/orders/${orderId}/discount`, {
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
};
