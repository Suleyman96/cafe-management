'use client';

import {
  getKitchenUrgencyBand,
  isDeliveryOrder,
  isDineInOrder,
  isItemStatusAtOrPast,
  isTakeoutOrder,
  ORDER_STATUS_KEYS,
} from '@gustri/core';
import type { OrderItemStatus, OrderStatus } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import type { KitchenOrderView } from '@gustri/queries';
import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { ORDER_ITEM_STATUS_BADGES } from '@gustri/ui-web';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  useCancelOrder,
  useCategories,
  useFeatureFlag,
  useKitchenView,
  useUpdateOrderItemStatus,
  useUpdateOrderStatus,
} from '@/hooks';
import { useClockSync } from '@/hooks/use-clock-sync';
import { usePendingAction } from '@/hooks/use-pending-action';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { ORDER_ITEM_STATUS_ICONS } from '@/lib/enum-icons';
import { getServerNow } from '@/lib/server-clock';
import { useAuthStore } from '@/store/auth-store';

/**
 * Skew threshold above which the kitchen view surfaces a "device clock is
 * off" banner. Two minutes is the smallest gap that meaningfully distorts
 * elapsed-time on a typical 5-15 minute kitchen prep cycle — below it,
 * the existing 30s tick granularity masks the difference. Above it, every
 * card's elapsed-minutes count is visibly wrong and staff would
 * mis-prioritise. The banner asks the user to fix the device, not the
 * app — there is no way for the app to override the OS clock.
 */
const CLOCK_SKEW_BANNER_THRESHOLD_MS = 2 * 60 * 1000;

// Check if all non-cancelled items in an order are served
function allItemsServed(order: KitchenOrderView): boolean {
  const items = order.order_items?.filter((item) => item.status !== 'cancelled') || [];
  if (items.length === 0) return false;
  return items.every((item) => item.status === 'served');
}

// Check if all non-cancelled items in an order are ready (or served)
function allItemsReady(order: KitchenOrderView): boolean {
  const items = order.order_items?.filter((item) => item.status !== 'cancelled') || [];
  if (items.length === 0) return false;
  return items.every((item) => item.status === 'ready' || item.status === 'served');
}

// Calculate elapsed time. Uses server-anchored `getServerNow()` rather than
// `Date.now()` so a drifted device clock can't reclassify orders as overdue
// (or wrongly fresh). See lib/server-clock.ts.
function calculateElapsedTime(createdAt: string): number {
  const startMs = new Date(createdAt).getTime();
  return Math.floor((getServerNow() - startMs) / 1000 / 60);
}

// Get time color based on elapsed time. Band comes from the canonical
// classifier in `@gustri/core` so this and the mobile kitchen agree on what
// counts as "critical" etc.
function getTimeColor(minutes: number, status: string): string {
  const band = getKitchenUrgencyBand({ minutesElapsed: minutes, status });
  if (band === 'ready') return 'text-green-600';
  if (band === 'critical') return 'text-red-600';
  if (band === 'elevated') return 'text-orange-600';
  if (band === 'warning') return 'text-yellow-600';
  // 'new' and 'default' fall through to gray.
  return 'text-gray-600';
}

// Get card color based on status, time, and item statuses.
function getCardColor(order: KitchenOrderView, minutes: number): string {
  const band = getKitchenUrgencyBand({
    minutesElapsed: minutes,
    status: order.status,
    allItemsReady: allItemsReady(order),
  });
  if (band === 'ready') return 'bg-green-50 border-green-400 shadow-green-200';
  if (band === 'new') return 'bg-blue-100 border-blue-400 ring-4 ring-blue-500/50 shadow-blue-200';
  if (band === 'critical') return 'bg-red-100 border-red-400 shadow-red-200';
  if (band === 'elevated') return 'bg-orange-100 border-orange-400 shadow-orange-200';
  // 'warning' AND 'default' both render yellow — preserves current web behavior.
  return 'bg-yellow-50 border-yellow-400 shadow-yellow-200';
}

// Get order number from ID (last 4 characters)
function getOrderNumber(orderId: string): string {
  return orderId.slice(-4).toUpperCase();
}

// Kitchen-specific overrides — high-contrast colors for visibility on the dark
// kitchen display, and dedicated label keys ("Cooking" not "Preparing").
const KITCHEN_STATUS_LABEL_KEYS: Partial<Record<OrderStatus, string>> = {
  new: 'kitchen.newStatus',
  preparing: 'kitchen.cookingStatus',
  ready: 'kitchen.readyStatus',
};

const KITCHEN_STATUS_BADGE_COLORS: Partial<Record<OrderStatus, string>> = {
  new: 'bg-blue-600 text-white',
  preparing: 'bg-yellow-500 text-black',
  ready: 'bg-green-600 text-white',
};

function getStatusBadgeColor(status: string): string {
  return KITCHEN_STATUS_BADGE_COLORS[status as OrderStatus] ?? 'bg-gray-500 text-white';
}

// Item-status display in the kitchen overrides two labels (pending →
// common.pending, preparing → kitchen.cooking) but otherwise mirrors the
// shared `ORDER_ITEM_STATUS_BADGES` colors and icons.
const KITCHEN_ITEM_LABEL_OVERRIDES: Partial<Record<OrderItemStatus, { key: string; ns?: string }>> =
  {
    pending: { key: 'pending', ns: 'common' },
    preparing: { key: 'kitchen.cooking' },
  };

/**
 * Controller for the kitchen display: the category-filtered active queue,
 * status counts, clock-skew detection, realtime sync, and the per-station
 * bulk/item status-advance handlers (with their order-level sync rules).
 * Extracted verbatim from KitchenDisplayPage — behavior unchanged.
 */
export function useKitchenDisplay() {
  const { t } = useTranslation('staff');
  const rawStaffId = useAuthStore((s) => s.staff?.id ?? null);
  // Per-tenant kill switch. Default false ⇒ pre-feature behavior.
  const filteringEnabled = useFeatureFlag('kitchen_category_filters');
  const staffId = filteringEnabled ? rawStaffId : null;
  const { visibleOrders, activeFilter, isLoading: loading, error } = useKitchenView(staffId);
  const { data: categories = [] } = useCategories();
  const updateOrderStatus = useUpdateOrderStatus();
  const updateItemStatus = useUpdateOrderItemStatus();
  const cancelOrder = useCancelOrder();
  const [rejectingOrder, setRejectingOrder] = useState<KitchenOrderView | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const tenantId = useTenantId();
  // Per-button pending lock — keys scoped per row/item.
  const { isPending, run } = usePendingAction<string>();

  // Filter orders for kitchen display (new, preparing, ready) - exclude orders
  // where all items are served. `visibleOrders` is already category-filtered.
  // Memoized so the filter+sort don't re-run on every render (e.g. a per-button
  // pending-lock toggle) — only when the order list itself changes.
  const kitchenOrders = useMemo(
    () =>
      visibleOrders
        .filter(
          (order) => ['new', 'preparing', 'ready'].includes(order.status) && !allItemsServed(order),
        )
        .sort((a, b) => {
          // Sort by status priority (new > preparing > ready) then by time
          const statusPriority = { 'new': 0, preparing: 1, ready: 2 };
          const aPriority = statusPriority[a.status as keyof typeof statusPriority];
          const bPriority = statusPriority[b.status as keyof typeof statusPriority];
          if (aPriority !== bPriority) return aPriority - bPriority;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }),
    [visibleOrders],
  );

  // Filter pending approval orders (QR orders awaiting staff approval).
  const pendingApprovalOrders = useMemo(
    () =>
      visibleOrders
        .filter((order) => order.status === 'pending_approval')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [visibleOrders],
  );

  // Count orders by status
  const { newOrdersCount, preparingCount, readyCount } = useMemo(
    () => ({
      newOrdersCount: kitchenOrders.filter((o) => o.status === 'new').length,
      preparingCount: kitchenOrders.filter((o) => o.status === 'preparing').length,
      readyCount: kitchenOrders.filter((o) => o.status === 'ready').length,
    }),
    [kitchenOrders],
  );

  // Real-time: invalidate queries on DB changes. The third subscription is
  // staff-scoped (not tenant-scoped) so a manager updating *another* staff
  // member's filter doesn't fan out to every kitchen device.
  const { lastEventAtRef } = useRealtimeSync('kitchen-realtime', [
    {
      table: 'orders',
      queryKeys: [
        tenantKey(tenantId, QUERY_KEYS.ORDERS),
        tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS),
      ],
    },
    {
      table: 'order_items',
      queryKeys: [tenantKey(tenantId, QUERY_KEYS.ORDERS)],
    },
    ...(staffId
      ? [
          {
            table: 'staff_kitchen_filters',
            queryKeys: [tenantKey(tenantId, QUERY_KEYS.STAFF_KITCHEN_FILTERS, staffId)],
            filter: `staff_id=eq.${staffId}`,
          },
        ]
      : []),
  ]);

  // Surface a banner when the device clock is meaningfully out of sync.
  const clockSync = useClockSync();
  const showClockSkewBanner =
    clockSync.lastSyncedAt > 0 && Math.abs(clockSync.offsetMs) >= CLOCK_SKEW_BANNER_THRESHOLD_MS;
  const clockSkewMinutes = Math.round(Math.abs(clockSync.offsetMs) / 60_000);
  const deviceIsBehind = clockSync.offsetMs > 0;

  const getStatusLabel = (status: string) => {
    const kitchenKey = KITCHEN_STATUS_LABEL_KEYS[status as OrderStatus];
    if (kitchenKey) return t(kitchenKey);
    const key = ORDER_STATUS_KEYS[status];
    return key ? t(key) : status;
  };

  const getItemStatusStyle = (status: string) => {
    const config = ORDER_ITEM_STATUS_BADGES[status as OrderItemStatus];
    const Icon = ORDER_ITEM_STATUS_ICONS[status as OrderItemStatus];
    if (!config) {
      return {
        bg: 'bg-gray-100',
        border: 'border-gray-300',
        text: 'text-gray-700',
        icon: null,
        label: status,
      };
    }
    const override = KITCHEN_ITEM_LABEL_OVERRIDES[status as OrderItemStatus];
    const label = override
      ? t(override.key, override.ns ? { ns: override.ns } : undefined)
      : t(config.labelKey);
    return {
      bg: config.bg,
      border: config.border ?? 'border-gray-300',
      text: config.text,
      icon: Icon ? <Icon className="h-4 w-4" /> : null,
      label,
    };
  };

  // Handle status update — also updates all item statuses to stay in sync.
  // Per-station filtering: the bulk button advances only THIS station's items
  // (visibleItems), and the order-level status only advances when every item
  // across every station would be at/past the target.
  const handleStatusUpdate = (orderId: string, newStatus: 'PREPARING' | 'READY' | 'SERVED') =>
    run(`order:${orderId}:${newStatus}`, async () => {
      try {
        const order = kitchenOrders?.find((o) => o.id === orderId);
        if (!order) return;

        const targetItemStatus =
          newStatus === 'PREPARING' ? 'preparing' : newStatus === 'READY' ? 'ready' : 'served';

        // Track ids we just advanced so the order-level decision below reflects
        // the post-mutation state without re-reading the cache.
        const advancedIds = new Set<string>();
        for (const item of order.visibleItems) {
          if (item.status === 'cancelled' || item.status === targetItemStatus) continue;
          if (targetItemStatus === 'preparing' && item.status !== 'pending') continue;
          if (
            targetItemStatus === 'ready' &&
            item.status !== 'pending' &&
            item.status !== 'preparing'
          )
            continue;

          await updateItemStatus.mutateAsync({
            itemId: item.id,
            status: targetItemStatus as 'pending' | 'preparing' | 'ready' | 'served',
          });
          advancedIds.add(item.id);
        }

        // Order-level advancement is only safe when EVERY non-cancelled item
        // (across every station) is at or past the target.
        const wholeOrderReadyToAdvance =
          targetItemStatus === 'preparing' ||
          order.order_items.every(
            (item) =>
              item.status === 'cancelled' ||
              advancedIds.has(item.id) ||
              isItemStatusAtOrPast(item.status, targetItemStatus),
          );

        // Don't set delivery/takeout orders to "served" — they follow a different flow
        const isTerminalServed =
          newStatus === 'SERVED' && (isDeliveryOrder(order) || isTakeoutOrder(order));
        if (!isTerminalServed && wholeOrderReadyToAdvance) {
          await updateOrderStatus.mutateAsync({
            orderId,
            status: newStatus,
          });
        }
        // Don't show toast in kitchen view to avoid distractions
      } catch (_error) {
        toast.error(t('orders.failedUpdateStatus'));
      }
    });

  // Handle QR order approval
  const handleApproveOrder = (orderId: string) =>
    run(`order:${orderId}:APPROVE`, async () => {
      try {
        await updateOrderStatus.mutateAsync({ orderId, status: 'NEW' });
        toast.success(t('kitchen.orderApproved'));
      } catch (_error) {
        toast.error(t('orders.failedUpdateStatus'));
      }
    });

  // Dispatch a ready delivery order (no item-level sync — the whole order moves).
  const handleMarkOutForDelivery = (orderId: string) =>
    run(`order:${orderId}:OUT_FOR_DELIVERY`, async () => {
      try {
        await updateOrderStatus.mutateAsync({ orderId, status: 'OUT_FOR_DELIVERY' });
      } catch (_error) {
        toast.error(t('orders.failedUpdateStatus'));
      }
    });

  // Handle QR order rejection
  const handleRejectOrder = () =>
    run('reject', async () => {
      if (!rejectingOrder || !rejectReason.trim()) return;
      try {
        await cancelOrder.mutateAsync({
          orderId: rejectingOrder.id,
          reason: rejectReason,
          tableId: rejectingOrder.table_id,
        });
        toast.success(t('kitchen.orderRejected'));
        setRejectingOrder(null);
        setRejectReason('');
      } catch (_error) {
        toast.error(t('orders.failedUpdateStatus'));
      }
    });

  // Handle item status update - also auto-update order status if needed
  const handleItemStatusUpdate = (itemId: string, newStatus: string, order: KitchenOrderView) =>
    run(`item:${itemId}:${newStatus}`, async () => {
      try {
        // If order is still "new", automatically change to "preparing"
        if (order.status === 'new') {
          await updateOrderStatus.mutateAsync({
            orderId: order.id,
            status: 'PREPARING',
          });
        }

        await updateItemStatus.mutateAsync({
          itemId,
          status: newStatus as 'pending' | 'preparing' | 'ready' | 'served',
        });

        // Check if all items will be ready after this update
        if (newStatus === 'ready' && order.status === 'preparing') {
          const otherItems =
            order.order_items?.filter(
              (item) => item.id !== itemId && item.status !== 'cancelled',
            ) || [];
          const allOthersReady = otherItems.every(
            (item) => item.status === 'ready' || item.status === 'served',
          );

          // If all other items are ready/served, update order status to ready
          if (allOthersReady) {
            await updateOrderStatus.mutateAsync({
              orderId: order.id,
              status: 'READY',
            });
          }
        }

        // Check if all items will be served after this update
        if (newStatus === 'served' && order.status === 'ready') {
          const otherItems =
            order.order_items?.filter(
              (item) => item.id !== itemId && item.status !== 'cancelled',
            ) || [];
          const allOthersServed = otherItems.every((item) => item.status === 'served');

          // If all other items are served, update order status to served.
          // Skip for delivery/takeout orders — they follow different flows
          if (allOthersServed && isDineInOrder(order)) {
            await updateOrderStatus.mutateAsync({
              orderId: order.id,
              status: 'SERVED',
            });
          }
        }

        // No toast for kitchen - faster feedback via visual change
      } catch (_error) {
        toast.error(t('orders.failedUpdateStatus'));
      }
    });

  return {
    // data + derived queue
    loading,
    error,
    staffId,
    categories,
    activeFilter,
    kitchenOrders,
    pendingApprovalOrders,
    newOrdersCount,
    preparingCount,
    readyCount,
    lastEventAtRef,
    // clock skew
    showClockSkewBanner,
    deviceIsBehind,
    clockSkewMinutes,
    // reject + filter state
    rejectingOrder,
    setRejectingOrder,
    rejectReason,
    setRejectReason,
    filterDrawerOpen,
    setFilterDrawerOpen,
    // per-button pending lock
    isPending,
    // display helpers
    calculateElapsedTime,
    getTimeColor,
    getCardColor,
    getOrderNumber,
    getStatusLabel,
    getStatusBadgeColor,
    getItemStatusStyle,
    allItemsReady,
    // handlers
    handleStatusUpdate,
    handleApproveOrder,
    handleMarkOutForDelivery,
    handleRejectOrder,
    handleItemStatusUpdate,
  };
}
