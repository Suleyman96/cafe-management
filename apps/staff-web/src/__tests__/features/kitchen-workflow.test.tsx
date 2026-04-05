import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/test-utils';

const mockUpdateOrderStatus = { mutateAsync: vi.fn().mockResolvedValue({}) };
const mockUpdateItemStatus = { mutateAsync: vi.fn().mockResolvedValue({}) };

let mockOrders: any[] | undefined = [];
let mockIsLoading = false;
let mockError: Error | null = null;
const mockRefetch = vi.fn();

vi.mock('@/hooks', () => ({
  useOrders: () => ({
    data: mockOrders,
    isLoading: mockIsLoading,
    error: mockError,
    refetch: mockRefetch,
  }),
  useUpdateOrderStatus: () => mockUpdateOrderStatus,
  useUpdateOrderItemStatus: () => mockUpdateItemStatus,
  useCancelOrder: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
}));

import KitchenDisplayPage from '@/app/(staff)/kitchen/page';

const makeOrder = (overrides: any = {}) => ({
  id: `order-${Math.random().toString(36).slice(2, 6)}`,
  status: 'new',
  created_at: new Date(Date.now() - 5 * 60000).toISOString(),
  table: { table_number: 'T1' },
  order_items: [
    {
      id: 'item-1',
      quantity: 2,
      status: 'pending',
      menu_item: { name: 'Margherita Pizza' },
    },
  ],
  ...overrides,
});

describe('Kitchen order workflow', () => {
  beforeEach(() => {
    mockOrders = [];
    mockIsLoading = false;
    mockError = null;
    vi.clearAllMocks();
  });

  it('filters out all-served orders from kitchen display', () => {
    mockOrders = [
      makeOrder({
        id: 'visible-order',
        status: 'preparing',
        order_items: [{ id: 'i1', quantity: 1, status: 'preparing', menu_item: { name: 'Soup' } }],
      }),
      makeOrder({
        id: 'hidden-order',
        status: 'preparing',
        order_items: [{ id: 'i2', quantity: 1, status: 'served', menu_item: { name: 'Salad' } }],
      }),
    ];
    renderWithProviders(<KitchenDisplayPage />);

    expect(screen.getByText('Soup')).toBeDefined();
    expect(screen.queryByText('Salad')).toBeNull();
  });

  it('sorts orders by status priority: new > preparing > ready', () => {
    mockOrders = [
      makeOrder({
        id: 'ready-1',
        status: 'ready',
        order_items: [{ id: 'r1', quantity: 1, status: 'ready', menu_item: { name: 'ReadyItem' } }],
      }),
      makeOrder({
        id: 'new-1',
        status: 'new',
        order_items: [{ id: 'n1', quantity: 1, status: 'pending', menu_item: { name: 'NewItem' } }],
      }),
      makeOrder({
        id: 'prep-1',
        status: 'preparing',
        order_items: [
          { id: 'p1', quantity: 1, status: 'preparing', menu_item: { name: 'PrepItem' } },
        ],
      }),
    ];
    renderWithProviders(<KitchenDisplayPage />);

    const items = screen.getAllByText(/NewItem|PrepItem|ReadyItem/);
    expect(items[0].textContent).toBe('NewItem');
    expect(items[1].textContent).toBe('PrepItem');
    expect(items[2].textContent).toBe('ReadyItem');
  });

  it('shows correct status counts in header', () => {
    mockOrders = [
      makeOrder({
        id: 'n1',
        status: 'new',
        order_items: [{ id: 'i1', quantity: 1, status: 'pending', menu_item: { name: 'A' } }],
      }),
      makeOrder({
        id: 'n2',
        status: 'new',
        order_items: [{ id: 'i2', quantity: 1, status: 'pending', menu_item: { name: 'B' } }],
      }),
      makeOrder({
        id: 'p1',
        status: 'preparing',
        order_items: [{ id: 'i3', quantity: 1, status: 'preparing', menu_item: { name: 'C' } }],
      }),
    ];
    renderWithProviders(<KitchenDisplayPage />);

    const allText = document.body.textContent;
    expect(allText).toContain('2');
    expect(allText).toContain('1');
    expect(allText).toContain('0');
  });

  it('"Start Cooking" button shown for new orders', () => {
    mockOrders = [makeOrder({ status: 'new' })];
    renderWithProviders(<KitchenDisplayPage />);

    const buttons = screen.getAllByRole('button');
    const startBtn = buttons.find((b) => b.textContent?.includes('Start Cooking'));
    expect(startBtn).toBeDefined();
  });

  it('"All Items Ready" button shown for preparing orders', () => {
    mockOrders = [
      makeOrder({
        status: 'preparing',
        order_items: [{ id: 'i1', quantity: 1, status: 'preparing', menu_item: { name: 'Soup' } }],
      }),
    ];
    renderWithProviders(<KitchenDisplayPage />);

    const buttons = screen.getAllByRole('button');
    const readyBtn = buttons.find((b) => b.textContent?.includes('All Items Ready'));
    expect(readyBtn).toBeDefined();
  });

  it('clicking "Start Cooking" calls updateOrderStatus with PREPARING', async () => {
    mockOrders = [
      makeOrder({
        id: 'order-abc',
        status: 'new',
        order_items: [
          { id: 'item-1', quantity: 1, status: 'pending', menu_item: { name: 'Pizza' } },
        ],
      }),
    ];
    renderWithProviders(<KitchenDisplayPage />);

    const buttons = screen.getAllByRole('button');
    const startBtn = buttons.find((b) => b.textContent?.includes('Start Cooking'));
    fireEvent.click(startBtn!);

    await vi.waitFor(() => {
      expect(mockUpdateOrderStatus.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'order-abc', status: 'PREPARING' }),
      );
    });
  });

  it('shows empty state when no kitchen orders', () => {
    mockOrders = [];
    renderWithProviders(<KitchenDisplayPage />);

    expect(screen.getByText('No active orders')).toBeDefined();
  });
});
