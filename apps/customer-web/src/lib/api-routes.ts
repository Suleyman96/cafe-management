import type { Database } from '@gustri/database';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

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
    throw new Error('Too many requests. Please wait a moment and try again.');
  }

  recent.push(now);
  requestTimestamps.set(path, recent);
}

async function apiFetch<T>(path: string, init: RequestInit): Promise<T> {
  // Client-side throttle: max 5 POST requests per 30s per endpoint
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

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.error || `API error ${res.status}`);
  }

  return body as T;
}

/**
 * Typed client for calling staff-web API routes.
 * Used for mutations that require server-side validation (plan limits, etc.).
 */
// Tenant binding is derived server-side (C1). The client sends `table_id`
// (dine_in) or `qr_token` (takeout/delivery) and the staff-web route
// resolves the tenant from those — never from the request body.
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

export const apiRoutes = {
  customerOrders: {
    create: (data: CreateCustomerOrderPayload) =>
      apiFetch<{ order: OrderRow }>('/api/v1/customer/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    addItems: (
      orderId: string,
      items: Array<{
        menu_item_id: string;
        item_name: string;
        item_price: number;
        quantity: number;
        notes?: string | null;
        tenant_id: string;
      }>,
    ) =>
      apiFetch<{ items: OrderItemRow[] }>(`/api/v1/customer/orders/${orderId}/items`, {
        method: 'POST',
        body: JSON.stringify({ items }),
      }),
  },
};
