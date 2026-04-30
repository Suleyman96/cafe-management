import { QUERY_KEYS } from '@gustri/queries';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const data = new Map<string, unknown>();
  return {
    navigateMock: vi.fn(),
    isReadyMock: vi.fn(() => true),
    ordersFindById: vi.fn(),
    tablesFindById: vi.fn(),
    cacheStore: data,
  };
});

vi.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({
    isReady: hoisted.isReadyMock,
    navigate: hoisted.navigateMock,
  }),
}));

vi.mock('@/lib/query-client', () => ({
  queryClient: {
    getQueryData: (key: unknown[]) => hoisted.cacheStore.get(JSON.stringify(key)),
  },
}));

vi.mock('@/lib/supabase', () => ({
  db: {
    orders: { findById: (...a: unknown[]) => hoisted.ordersFindById(...a) },
    tables: { findById: (...a: unknown[]) => hoisted.tablesFindById(...a) },
  },
  supabase: {},
}));

import { handleNotificationNavigation } from '@/lib/navigation-ref';
import { useAuthStore } from '@/store/auth-store';

const TENANT = 'tenant-A';
const FOREIGN = 'tenant-B';

function setStaff(tenantId: string | null) {
  useAuthStore.setState({
    staff: tenantId ? ({ id: 'me', tenant_id: tenantId } as never) : null,
  });
}

function seedCache(key: unknown[], data: unknown) {
  hoisted.cacheStore.set(JSON.stringify(key), data);
}

describe('handleNotificationNavigation tenant validation', () => {
  beforeEach(() => {
    hoisted.cacheStore.clear();
    hoisted.navigateMock.mockReset();
    hoisted.ordersFindById.mockReset();
    hoisted.tablesFindById.mockReset();
    hoisted.isReadyMock.mockReturnValue(true);
    setStaff(TENANT);
  });

  afterEach(() => {
    setStaff(null);
  });

  // Sanity: confirm imports used as values keep the bundler happy.
  it('QueryClient class is importable (sanity)', () => {
    expect(QueryClient).toBeDefined();
  });

  it('routes to OrderDetail when the cached order matches the current tenant', async () => {
    seedCache([QUERY_KEYS.ORDERS], [{ id: 'order-1', tenant_id: TENANT }]);

    await handleNotificationNavigation({ type: 'new_order', orderId: 'order-1' });

    expect(hoisted.navigateMock).toHaveBeenCalledWith(
      'Main',
      expect.objectContaining({ screen: 'OrdersTab' }),
    );
    expect(hoisted.ordersFindById).not.toHaveBeenCalled();
  });

  it('routes to NotificationExpired when the cached order is foreign', async () => {
    seedCache([QUERY_KEYS.ORDERS], [{ id: 'order-1', tenant_id: FOREIGN }]);

    await handleNotificationNavigation({ type: 'new_order', orderId: 'order-1' });

    expect(hoisted.navigateMock).toHaveBeenCalledWith('NotificationExpired');
  });

  it('falls through to wrapper fetch on cache miss; null result → expired', async () => {
    hoisted.ordersFindById.mockResolvedValueOnce(null);

    await handleNotificationNavigation({ type: 'order_ready', orderId: 'order-x' });

    expect(hoisted.ordersFindById).toHaveBeenCalledWith('order-x');
    expect(hoisted.navigateMock).toHaveBeenCalledWith('NotificationExpired');
  });

  it('falls through to wrapper fetch on cache miss; matching tenant → OrderDetail', async () => {
    hoisted.ordersFindById.mockResolvedValueOnce({ id: 'order-y', tenant_id: TENANT });

    await handleNotificationNavigation({ type: 'new_order', orderId: 'order-y' });

    expect(hoisted.navigateMock).toHaveBeenCalledWith(
      'Main',
      expect.objectContaining({ screen: 'OrdersTab' }),
    );
  });

  it('routes waiter_call to TableDetail only for matching tenant', async () => {
    seedCache([QUERY_KEYS.TABLES], [{ id: 'table-1', tenant_id: TENANT }]);

    await handleNotificationNavigation({ type: 'waiter_call', tableId: 'table-1' });

    expect(hoisted.navigateMock).toHaveBeenCalledWith(
      'Main',
      expect.objectContaining({ screen: 'TablesTab' }),
    );
  });

  it('queues the notification when the user is not signed in', async () => {
    setStaff(null);
    await handleNotificationNavigation({ type: 'new_order', orderId: 'order-1' });
    expect(hoisted.navigateMock).not.toHaveBeenCalled();
  });
});
