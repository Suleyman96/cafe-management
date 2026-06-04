'use client';

import {
  formatSelectedOptions,
  getKitchenUrgencyBand,
  isDeliveryOrder,
  isDineInOrder,
  isTakeoutOrder,
  ORDER_STATUS_KEYS,
  TIME_ELAPSED_THRESHOLDS,
} from '@gustri/core';
import type { OrderItemStatus, OrderStatus } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import type { KitchenOrderView } from '@gustri/queries';
import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { LoadingSpinner, ORDER_ITEM_STATUS_BADGES, Skeleton } from '@gustri/ui-web';
import {
  AlertCircle,
  CheckCircle,
  ChefHat,
  Package,
  Smartphone,
  Timer,
  Truck,
  User,
  Utensils,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { FreshnessIndicator } from '@/components/common/freshness-indicator';
import { ElapsedTime } from '@/components/kitchen/elapsed-time';
import { HiddenItemsSummary } from '@/components/kitchen/hidden-items-summary';
import { KitchenFilterBar } from '@/components/kitchen/kitchen-filter-bar';
import { KitchenFilterDrawer } from '@/components/kitchen/kitchen-filter-drawer';
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

// Item-status progression order for the per-station bulk advance check.
// `cancelled` is excluded — cancellation is terminal but does not block
// the rest of an order from progressing.
const ITEM_STATUS_PROGRESS: Record<OrderItemStatus, number> = {
  pending: 0,
  preparing: 1,
  ready: 2,
  served: 3,
  cancelled: -1,
};

function isAtOrPast(actual: OrderItemStatus, target: OrderItemStatus): boolean {
  return ITEM_STATUS_PROGRESS[actual] >= ITEM_STATUS_PROGRESS[target];
}

export default function KitchenDisplayPage() {
  const { t } = useTranslation('staff');
  const router = useRouter();
  const rawStaffId = useAuthStore((s) => s.staff?.id ?? null);
  // Per-tenant kill switch. Default false ⇒ pre-feature behavior. We pass
  // `null` for staff_id when the flag is off so `useStaffKitchenFilters`
  // never fires, `useKitchenView` derives "show all", and the bulk
  // handlers degenerate to their original semantics. Removing this flag
  // (target: 2 weeks after enable per CLAUDE.md) is a 3-line edit:
  // delete the flag check and inline `staffId = rawStaffId`.
  const filteringEnabled = useFeatureFlag('kitchen_category_filters');
  const staffId = filteringEnabled ? rawStaffId : null;
  // Kitchen view shows only the active queue, filtered to the categories
  // this staff member has selected (or all categories when no filter is set).
  // The hook composes useOrders + useStaffKitchenFilters + useCategories
  // and is the single source of truth for what this device should render.
  const { visibleOrders, activeFilter, isLoading: loading, error } = useKitchenView(staffId);
  // Categories drive the filter drawer's chip list. Fetched once and
  // shared with the drawer via prop so the drawer doesn't re-trigger
  // its own request on every open.
  const { data: categories = [] } = useCategories();
  const updateOrderStatus = useUpdateOrderStatus();
  const updateItemStatus = useUpdateOrderItemStatus();
  const cancelOrder = useCancelOrder();
  const [rejectingOrder, setRejectingOrder] = useState<KitchenOrderView | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const tenantId = useTenantId();
  // Per-button pending lock — keys are scoped per row/item (`order:<id>:<verb>`,
  // `item:<id>:<status>`, `reject`) so one stuck mutation doesn't disable
  // unrelated rows. The ref-based gate inside the hook collapses a triple-tap
  // to a single in-flight call even before React re-renders.
  const { isPending, run } = usePendingAction<string>();

  // Elapsed-time tick lives in the <ElapsedTime> leaf — no parent rerender.

  // Check if all non-cancelled items in an order are served
  const allItemsServed = (order: KitchenOrderView) => {
    const items = order.order_items?.filter((item) => item.status !== 'cancelled') || [];
    if (items.length === 0) return false;
    return items.every((item) => item.status === 'served');
  };

  // Check if all non-cancelled items in an order are ready (or served)
  const allItemsReady = (order: KitchenOrderView) => {
    const items = order.order_items?.filter((item) => item.status !== 'cancelled') || [];
    if (items.length === 0) return false;
    return items.every((item) => item.status === 'ready' || item.status === 'served');
  };

  // Filter orders for kitchen display (new, preparing, ready) - exclude orders where all items are served.
  // `visibleOrders` is already category-filtered for this station; orders with no
  // matching items have already been dropped upstream.
  const kitchenOrders = visibleOrders
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
    });

  // Filter pending approval orders (QR orders awaiting staff approval).
  // Pending approvals follow the same per-category filter — a station that
  // doesn't see any of an order's items shouldn't be the one approving it.
  const pendingApprovalOrders = visibleOrders
    .filter((order) => order.status === 'pending_approval')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Count orders by status
  const newOrdersCount = kitchenOrders?.filter((o) => o.status === 'new').length || 0;
  const preparingCount = kitchenOrders?.filter((o) => o.status === 'preparing').length || 0;
  const readyCount = kitchenOrders?.filter((o) => o.status === 'ready').length || 0;

  // Real-time: invalidate queries on DB changes. The third subscription
  // is staff-scoped (not tenant-scoped) so a manager updating *another*
  // staff member's filter doesn't fan out to every kitchen device.
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

  // Calculate elapsed time. Uses server-anchored `getServerNow()` rather
  // than `Date.now()` so a drifted device clock can't reclassify orders
  // as overdue (or wrongly fresh). See lib/server-clock.ts.
  const calculateElapsedTime = (createdAt: string) => {
    const startMs = new Date(createdAt).getTime();
    const diffMinutes = Math.floor((getServerNow() - startMs) / 1000 / 60);
    return diffMinutes;
  };

  // Surface a banner when the device clock is meaningfully out of sync
  // with the server. Reads from useSyncExternalStore so it only re-renders
  // when a sync sample actually lands, not on every Date.now() tick.
  const clockSync = useClockSync();
  const showClockSkewBanner =
    clockSync.lastSyncedAt > 0 && Math.abs(clockSync.offsetMs) >= CLOCK_SKEW_BANNER_THRESHOLD_MS;
  const clockSkewMinutes = Math.round(Math.abs(clockSync.offsetMs) / 60_000);
  const deviceIsBehind = clockSync.offsetMs > 0;

  // Get time color based on elapsed time. Band comes from the canonical
  // classifier in `@gustri/core` so this and the mobile kitchen agree on
  // what counts as "critical" etc.
  const getTimeColor = (minutes: number, status: string) => {
    const band = getKitchenUrgencyBand({ minutesElapsed: minutes, status });
    if (band === 'ready') return 'text-green-600';
    if (band === 'critical') return 'text-red-600';
    if (band === 'elevated') return 'text-orange-600';
    if (band === 'warning') return 'text-yellow-600';
    // 'new' and 'default' fall through to gray — preserves original
    // behavior where new orders' inline minute text was gray (the blue
    // tint lives on the card surface, not the numeric).
    return 'text-gray-600';
  };

  // Get card color based on status, time, and item statuses.
  const getCardColor = (order: KitchenOrderView, minutes: number) => {
    const band = getKitchenUrgencyBand({
      minutesElapsed: minutes,
      status: order.status,
      allItemsReady: allItemsReady(order),
    });
    if (band === 'ready') return 'bg-green-50 border-green-400 shadow-green-200';
    if (band === 'new')
      return 'bg-blue-100 border-blue-400 ring-4 ring-blue-500/50 shadow-blue-200';
    if (band === 'critical') return 'bg-red-100 border-red-400 shadow-red-200';
    if (band === 'elevated') return 'bg-orange-100 border-orange-400 shadow-orange-200';
    // 'warning' AND 'default' both render yellow — preserves current web
    // behavior (no separate neutral surface below WARNING). Aligning with
    // mobile's distinct default surface is a UX decision tracked
    // separately; do not silently change it here.
    return 'bg-yellow-50 border-yellow-400 shadow-yellow-200';
  };

  // Get order number from ID (last 4 characters)
  const getOrderNumber = (orderId: string) => {
    return orderId.slice(-4).toUpperCase();
  };

  // Kitchen-specific overrides — high-contrast colors for visibility on the
  // dark kitchen display, and dedicated label keys ("Cooking" not "Preparing").
  // Only the three active kitchen states get an override; everything else falls
  // back to the shared `ORDER_STATUS_KEYS` and the gray default.
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

  const getStatusLabel = (status: string) => {
    const kitchenKey = KITCHEN_STATUS_LABEL_KEYS[status as OrderStatus];
    if (kitchenKey) return t(kitchenKey);
    const key = ORDER_STATUS_KEYS[status];
    return key ? t(key) : status;
  };

  const getStatusBadgeColor = (status: string) => {
    return KITCHEN_STATUS_BADGE_COLORS[status as OrderStatus] ?? 'bg-gray-500 text-white';
  };

  // Handle status update — also updates all item statuses to stay in sync.
  // Per-station filtering: the bulk button advances only THIS station's items
  // (visibleItems), and the order-level status only advances when every item
  // across every station would be at/past the target. Without this guard the
  // Pizza station's "All ready" click would mark an order ready while the bar
  // is still pouring drinks.
  const handleStatusUpdate = (orderId: string, newStatus: 'PREPARING' | 'READY' | 'SERVED') =>
    run(`order:${orderId}:${newStatus}`, async () => {
      try {
        const order = kitchenOrders?.find((o) => o.id === orderId);
        if (!order) return;

        const targetItemStatus =
          newStatus === 'PREPARING' ? 'preparing' : newStatus === 'READY' ? 'ready' : 'served';

        // Track ids we just advanced so the order-level decision below
        // reflects the post-mutation state without re-reading the cache.
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
        // (across every station) is at or past the target. For PREPARING the
        // existing flow already allows moving early — keep that behavior.
        const wholeOrderReadyToAdvance =
          targetItemStatus === 'preparing' ||
          order.order_items.every(
            (item) =>
              item.status === 'cancelled' ||
              advancedIds.has(item.id) ||
              isAtOrPast(item.status, targetItemStatus),
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

  // Item-status display in the kitchen overrides two labels (pending →
  // common.pending, preparing → kitchen.cooking) but otherwise mirrors the
  // shared `ORDER_ITEM_STATUS_BADGES` colors and icons.
  const KITCHEN_ITEM_LABEL_OVERRIDES: Partial<
    Record<OrderItemStatus, { key: string; ns?: string }>
  > = {
    pending: { key: 'pending', ns: 'common' },
    preparing: { key: 'kitchen.cooking' },
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

          // If all other items are served, update order status to served
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

  if (loading) {
    return (
      <div
        role="status"
        aria-busy
        aria-label={t('loading', { ns: 'common' })}
        className="min-h-screen bg-gray-900 p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton kitchen cards have no identity
            key={i}
            className="rounded-lg border border-gray-700 bg-gray-800 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-24 bg-gray-700" />
              <Skeleton className="h-5 w-14 bg-gray-700" />
            </div>
            <Skeleton className="h-4 w-3/4 bg-gray-700" />
            <Skeleton className="h-4 w-2/3 bg-gray-700" />
            <Skeleton className="h-10 w-full bg-gray-700" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <p className="text-red-500">{t('error', { ns: 'common' })}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-3 sm:p-6">
      {showClockSkewBanner && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 sm:mb-6 rounded-lg border-2 border-amber-400 bg-amber-100 px-3 sm:px-4 py-2 sm:py-3 flex items-start gap-2 sm:gap-3"
        >
          <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-amber-900 text-sm sm:text-base">
            <p className="font-semibold">{t('kitchen.clockSkewBannerTitle')}</p>
            <p className="mt-0.5">
              {t(
                deviceIsBehind ? 'kitchen.clockSkewBannerBehind' : 'kitchen.clockSkewBannerAhead',
                { count: clockSkewMinutes },
              )}
            </p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <Utensils className="h-6 sm:h-10 w-6 sm:w-10 text-white" />
          <h1 className="text-xl sm:text-3xl font-bold text-white">{t('kitchen.title')}</h1>
          <FreshnessIndicator
            lastEventAtRef={lastEventAtRef}
            className="bg-white/10 px-2 py-1 rounded-full"
          />
          {staffId && (
            <KitchenFilterBar
              activeFilter={activeFilter}
              onOpen={() => setFilterDrawerOpen(true)}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-6">
          {/* Status Summary */}
          <div className="flex gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-2 bg-blue-600 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg">
              <AlertCircle className="h-4 sm:h-6 w-4 sm:w-6 text-white" />
              <span className="text-white font-bold text-base sm:text-xl">{newOrdersCount}</span>
              <span className="text-blue-200 text-xs sm:text-sm hidden xs:inline">
                {t('kitchen.newOrders')}
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 bg-yellow-500 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg">
              <ChefHat className="h-4 sm:h-6 w-4 sm:w-6 text-black" />
              <span className="text-black font-bold text-base sm:text-xl">{preparingCount}</span>
              <span className="text-yellow-800 text-xs sm:text-sm hidden xs:inline">
                {t('kitchen.cooking')}
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 bg-green-600 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg">
              <CheckCircle className="h-4 sm:h-6 w-4 sm:w-6 text-white" />
              <span className="text-white font-bold text-base sm:text-xl">{readyCount}</span>
              <span className="text-green-200 text-xs sm:text-sm hidden xs:inline">
                {t('kitchen.readyLabel')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pending QR Orders Section */}
      {pendingApprovalOrders.length > 0 && (
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-bold text-amber-400">
              {t('kitchen.pendingQrOrders')} ({pendingApprovalOrders.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {pendingApprovalOrders.map((order) => {
              const itemCount =
                order.order_items?.filter((i) => i.status !== 'cancelled').length || 0;

              return (
                <div
                  key={order.id}
                  className="border-2 border-amber-500 bg-amber-950/50 rounded-xl p-3 sm:p-4 animate-pulse"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-xl sm:text-2xl font-black text-white">
                        #{getOrderNumber(order.id)}
                      </div>
                      <div className="text-sm font-bold text-amber-300">
                        {order.table?.table_number || t('orders.qrOrder', { ns: 'staff' })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500 text-black text-xs font-bold">
                      <Smartphone className="h-3 w-3" />
                      QR
                    </div>
                  </div>

                  {/* Timer */}
                  <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg bg-white/10">
                    <Timer className="h-4 w-4 text-amber-400" />
                    <span className="text-base font-bold text-amber-300">
                      <ElapsedTime since={order.created_at} />
                    </span>
                    <span className="text-xs text-amber-400">{t('kitchen.min')}</span>
                    <span className="ml-auto text-xs text-gray-400">
                      {t('kitchen.itemCount', { count: itemCount })}
                    </span>
                  </div>

                  {/* Order Items Preview */}
                  <div className="space-y-1 mb-3 max-h-24 overflow-y-auto">
                    {order.order_items
                      ?.filter((item) => item.status !== 'cancelled')
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-1.5 text-sm text-gray-300"
                        >
                          <span className="font-bold text-white bg-white/10 px-1.5 py-0.5 rounded text-xs">
                            {item.quantity}x
                          </span>
                          <span className="truncate">
                            {item.menu_item?.name}
                            {formatSelectedOptions(item.selected_options) && (
                              <span className="text-gray-400">
                                {' · '}
                                {formatSelectedOptions(item.selected_options)}
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveOrder(order.id)}
                      disabled={isPending(`order:${order.id}:APPROVE`)}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-green-800/60 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      {isPending(`order:${order.id}:APPROVE`) ? (
                        <LoadingSpinner size="sm" className="border-white/40 border-t-white" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      {t('approve', { ns: 'common' })}
                    </button>
                    <button
                      onClick={() => setRejectingOrder(order)}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="h-4 w-4" />
                      {t('reject', { ns: 'common' })}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Orders Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
        {kitchenOrders?.map((order) => {
          const elapsedMinutes = calculateElapsedTime(order.created_at);
          const timeColor = getTimeColor(elapsedMinutes, order.status);
          const cardColor = getCardColor(order, elapsedMinutes);

          return (
            <div
              key={order.id}
              className={`border-2 sm:border-4 rounded-xl p-3 sm:p-5 ${cardColor} transition-all shadow-lg ${
                order.status === 'new' ? 'animate-pulse' : ''
              }`}
            >
              {/* Order Header with Order Number */}
              <div className="flex justify-between items-start mb-2 sm:mb-4">
                <div>
                  {/* Order Number - Large and prominent */}
                  <div className="text-2xl sm:text-3xl font-black text-gray-800 mb-1">
                    #{getOrderNumber(order.id)}
                  </div>
                  <h3 className="text-base sm:text-xl font-bold text-gray-700">
                    {order.table ? (
                      order.table.table_number
                    ) : order.order_type === 'delivery' ? (
                      <span className="flex items-center gap-1 sm:gap-2 text-purple-700">
                        <Truck className="h-4 sm:h-5 w-4 sm:w-5" />
                        {t('orders.delivery')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 sm:gap-2 text-orange-700">
                        <Package className="h-4 sm:h-5 w-4 sm:w-5" />
                        {t('tables.takeout')}
                      </span>
                    )}
                  </h3>
                </div>
                {/* Status Badge */}
                <div
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold ${getStatusBadgeColor(order.status)}`}
                >
                  {getStatusLabel(order.status)}
                </div>
              </div>

              {/* Timer - Compact. Threshold-driven background and URGENT badge are
                  computed at parent render time from `order.created_at`; they refresh
                  on the next data event (item/order status change) rather than on a
                  60s force-rerender. The numeric minutes tick inside <ElapsedTime>. */}
              {/* Inline elapsed pill is intentionally time-only (no status
                  overrides — a "new" order at 25 min should still surface
                  red here even though its card is blue). Uses `>=` to match
                  the canonical band boundaries from getKitchenUrgencyBand. */}
              <div
                className={`flex items-center gap-1 sm:gap-2 mb-2 sm:mb-3 px-2 py-1 sm:py-1.5 rounded-lg ${
                  elapsedMinutes >= TIME_ELAPSED_THRESHOLDS.CRITICAL
                    ? 'bg-red-200'
                    : elapsedMinutes >= TIME_ELAPSED_THRESHOLDS.ELEVATED
                      ? 'bg-orange-200'
                      : elapsedMinutes >= TIME_ELAPSED_THRESHOLDS.WARNING
                        ? 'bg-yellow-200'
                        : 'bg-white/60'
                }`}
              >
                <Timer className={`h-4 sm:h-5 w-4 sm:w-5 ${timeColor}`} />
                <span className={`text-lg sm:text-xl font-bold ${timeColor}`}>
                  <ElapsedTime since={order.created_at} />
                </span>
                <span className={`text-xs sm:text-sm ${timeColor}`}>{t('kitchen.min')}</span>
                {elapsedMinutes >= TIME_ELAPSED_THRESHOLDS.ELEVATED && (
                  <span className="ml-auto text-red-600 text-xs sm:text-sm font-bold animate-pulse">
                    {t('kitchen.urgent')}
                  </span>
                )}
              </div>

              {/* Customer Info for Takeout */}
              {order.source === 'phone' && order.customer_name && (
                <div className="mb-4 p-3 bg-orange-100 rounded-lg border-2 border-orange-300">
                  <div className="flex items-center gap-2 text-lg">
                    <User className="h-5 w-5 text-orange-700" />
                    <span className="font-bold text-orange-800">{order.customer_name}</span>
                  </div>
                  {order.customer_phone && (
                    <div className="text-base text-orange-700 mt-1">{order.customer_phone}</div>
                  )}
                </div>
              )}

              {/* Order Notes */}
              {order.customer_notes && (
                <div className="mb-3 p-2 bg-red-200 rounded-lg border-2 border-red-400">
                  <p className="text-sm font-bold text-red-800">
                    📝 {t('kitchen.orderNotes')} {order.customer_notes}
                  </p>
                </div>
              )}

              {/* Order Items - Background color indicates status. Uses
                  visibleItems so a station only sees the items it owns;
                  hidden items are summarized below. */}
              <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto">
                {order.visibleItems
                  .filter((item) => item.status !== 'cancelled')
                  .map((item) => {
                    const itemStyle = getItemStatusStyle(item.status);

                    return (
                      <div
                        key={item.id}
                        className={`rounded p-1.5 border ${itemStyle.bg} ${itemStyle.border} transition-all`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-gray-800 bg-white/80 px-1.5 py-0.5 rounded flex-shrink-0">
                            {item.quantity}x
                          </span>
                          <span className="flex-1 text-sm font-semibold text-gray-800 min-w-0">
                            {item.menu_item?.name}
                          </span>
                          {/* Action Buttons for Item */}
                          <div className="flex-shrink-0">
                            {(item.status === 'pending' || item.status === 'preparing') && (
                              <button
                                onClick={() => handleItemStatusUpdate(item.id, 'ready', order)}
                                disabled={isPending(`item:${item.id}:ready`)}
                                className="px-1.5 py-0.5 bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:bg-green-700/60 disabled:cursor-not-allowed text-white text-xs font-bold rounded transition-colors shadow flex items-center gap-0.5"
                              >
                                {isPending(`item:${item.id}:ready`) ? (
                                  <LoadingSpinner
                                    size="sm"
                                    className="h-3 w-3 border-white/40 border-t-white"
                                  />
                                ) : (
                                  <CheckCircle className="h-3 w-3" />
                                )}
                                {t('orders.ready')}
                              </button>
                            )}
                            {item.status === 'ready' && (
                              <button
                                onClick={() => handleItemStatusUpdate(item.id, 'served', order)}
                                disabled={isPending(`item:${item.id}:served`)}
                                className="px-1.5 py-0.5 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 disabled:bg-purple-700/60 disabled:cursor-not-allowed text-white text-xs font-bold rounded transition-colors shadow flex items-center gap-0.5"
                              >
                                {isPending(`item:${item.id}:served`) ? (
                                  <LoadingSpinner
                                    size="sm"
                                    className="h-3 w-3 border-white/40 border-t-white"
                                  />
                                ) : (
                                  <UtensilsCrossed className="h-3 w-3" />
                                )}
                                {t('orders.served')}
                              </button>
                            )}
                            {item.status === 'served' && (
                              <CheckCircle className="h-4 w-4 text-purple-600" />
                            )}
                          </div>
                        </div>
                        {formatSelectedOptions(item.selected_options) && (
                          <p className="mt-0.5 pl-7 text-xs font-medium text-gray-600">
                            {formatSelectedOptions(item.selected_options)}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>

              <HiddenItemsSummary count={order.hiddenCount} byCategory={order.hiddenByCategory} />

              {/* Action Button - Compact touch target */}
              <div className="mt-auto">
                {order.status === 'new' && (
                  <button
                    onClick={() => handleStatusUpdate(order.id, 'PREPARING')}
                    disabled={isPending(`order:${order.id}:PREPARING`)}
                    className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 disabled:bg-yellow-700/60 disabled:cursor-not-allowed text-black text-base font-bold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    {isPending(`order:${order.id}:PREPARING`) ? (
                      <LoadingSpinner size="sm" className="border-black/30 border-t-black" />
                    ) : (
                      <ChefHat className="h-5 w-5" />
                    )}
                    {t('kitchen.startCooking')}
                  </button>
                )}
                {order.status === 'preparing' && (
                  <button
                    onClick={() => handleStatusUpdate(order.id, 'READY')}
                    disabled={isPending(`order:${order.id}:READY`)}
                    className="w-full py-2.5 bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:bg-green-700/60 disabled:cursor-not-allowed text-white text-base font-bold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    {isPending(`order:${order.id}:READY`) ? (
                      <LoadingSpinner size="sm" className="border-white/40 border-t-white" />
                    ) : (
                      <CheckCircle className="h-5 w-5" />
                    )}
                    {t('kitchen.allItemsReady')}
                  </button>
                )}
                {order.status === 'ready' && isDineInOrder(order) && (
                  <button
                    onClick={() => handleStatusUpdate(order.id, 'SERVED')}
                    disabled={isPending(`order:${order.id}:SERVED`)}
                    className="w-full py-2.5 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 disabled:bg-purple-700/60 disabled:cursor-not-allowed text-white text-base font-bold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    {isPending(`order:${order.id}:SERVED`) ? (
                      <LoadingSpinner size="sm" className="border-white/40 border-t-white" />
                    ) : (
                      <UtensilsCrossed className="h-5 w-5" />
                    )}
                    {t('kitchen.allServed')}
                  </button>
                )}
                {order.status === 'ready' && isDeliveryOrder(order) && (
                  <button
                    onClick={() =>
                      run(`order:${order.id}:OUT_FOR_DELIVERY`, async () => {
                        try {
                          await updateOrderStatus.mutateAsync({
                            orderId: order.id,
                            status: 'OUT_FOR_DELIVERY',
                          });
                        } catch (_error) {
                          toast.error(t('orders.failedUpdateStatus'));
                        }
                      })
                    }
                    disabled={isPending(`order:${order.id}:OUT_FOR_DELIVERY`)}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:bg-purple-800/60 disabled:cursor-not-allowed text-white text-base font-bold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    {isPending(`order:${order.id}:OUT_FOR_DELIVERY`) ? (
                      <LoadingSpinner size="sm" className="border-white/40 border-t-white" />
                    ) : (
                      <Truck className="h-5 w-5" />
                    )}
                    {t('orders.outForDelivery')}
                  </button>
                )}
                {order.status === 'ready' && isTakeoutOrder(order) && (
                  <button
                    onClick={() => router.push(`/orders/${order.id}`)}
                    className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-base font-bold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    <Package className="h-5 w-5" />
                    {t('kitchen.pickedUp')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State — distinguish "no orders at all" from "no orders match
          your filter" so a forgotten filter doesn't read as a system failure. */}
      {(!kitchenOrders || kitchenOrders.length === 0) && pendingApprovalOrders.length === 0 && (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <ChefHat className="h-32 w-32 mx-auto mb-6 text-gray-500" />
            {activeFilter.mode === 'filtered' ? (
              <>
                <p className="text-4xl font-bold text-gray-400 mb-2">{t('kitchen.filter.empty')}</p>
                <p className="text-xl text-gray-500 mb-4">{t('kitchen.filter.emptyHint')}</p>
                {staffId && (
                  <button
                    type="button"
                    onClick={() => setFilterDrawerOpen(true)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-base font-semibold rounded-lg"
                  >
                    {t('kitchen.filter.openButton')}
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="text-4xl font-bold text-gray-400 mb-2">
                  {t('kitchen.noActiveOrders')}
                </p>
                <p className="text-xl text-gray-500">{t('kitchen.waitingForOrders')}</p>
              </>
            )}
          </div>
        </div>
      )}

      {staffId && (
        <KitchenFilterDrawer
          isOpen={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
          staffId={staffId}
          categories={categories}
        />
      )}

      {/* Reject Order Modal */}
      {rejectingOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {t('reject', { ns: 'common' })} #{getOrderNumber(rejectingOrder.id)}
            </h3>
            <p className="text-sm text-gray-500 mb-4">{t('kitchen.rejectReason')}</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('kitchen.rejectReasonPlaceholder')}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm mb-4 focus:ring-2 focus:ring-red-500 focus:border-red-500"
              rows={3}
              // biome-ignore lint/a11y/noAutofocus: modal textarea should auto-focus
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setRejectingOrder(null);
                  setRejectReason('');
                }}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                {t('cancel', { ns: 'common' })}
              </button>
              <button
                onClick={handleRejectOrder}
                disabled={!rejectReason.trim() || isPending('reject')}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending('reject') && (
                  <LoadingSpinner size="sm" className="border-white/40 border-t-white" />
                )}
                {t('reject', { ns: 'common' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
