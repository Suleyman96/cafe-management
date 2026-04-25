import type { Database } from '@gustri/database';
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
    throw new Error('No active session — please log in');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function apiFetch<T>(path: string, init: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.error || `API error ${res.status}`);
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
      apiFetch<{ payment: Record<string, unknown> }>(`/api/v1/orders/${orderId}/payments`, {
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
};
