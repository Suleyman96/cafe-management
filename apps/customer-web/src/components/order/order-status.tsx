'use client';

import { isAppError } from '@gustri/core';
import { localizeErrorMessage, useTranslation } from '@gustri/i18n';
import { Badge, Button, LoadingSpinner } from '@gustri/ui-web';
import * as Sentry from '@sentry/nextjs';
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  Hourglass,
  Loader2,
  MessageSquare,
  Minus,
  Plus,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FeedbackForm } from '@/components/feedback/feedback-form';
import { OrderTimeline } from '@/components/order/order-timeline';
import { TableNotActiveScreen } from '@/components/table/table-not-active-screen';
import { PlatformFooter } from '@/components/ui/platform-footer';
import { ReconnectingBanner } from '@/components/ui/reconnecting-banner';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useCancelOrder, useCancelOrderItem, useOrder } from '@/hooks/use-order';
import { useOrderEta } from '@/hooks/use-order-eta';
import { useCafeSettings } from '@/hooks/use-settings';
import { useTable } from '@/hooks/use-table';
import { useCreateWaiterCall, useOpenWaiterCallsForTable } from '@/hooks/use-waiter-call';
import { timeAgo } from '@/lib/utils';
import { useOrderConfirmationStore } from '@/store/order-confirmation-store';

interface OrderStatusProps {
  tableId: string; // This is the table_number from URL (e.g., "T01")
}

export function OrderStatus({ tableId }: OrderStatusProps) {
  const router = useRouter();
  const { t } = useTranslation('customer');

  // Fetch table to get the actual UUID for database operations
  const { data: table, isLoading: tableLoading, error: tableError } = useTable(tableId);
  const actualTableId = table?.id || '';
  // H5 — staff renamed / deleted this table mid-session. Without this
  // gate, downstream `useOrder('')` is correctly disabled but the page
  // renders a stuck loading state with no explanation. Show an explicit
  // recovery screen instead.
  const tableNotFound = isAppError(tableError) && tableError.code === 'NOT_FOUND';

  const {
    data: order,
    isLoading: orderLoading,
    rtStatus,
    dataUpdatedAt,
    refresh: refreshOrder,
  } = useOrder(actualTableId);
  const { data: settings } = useCafeSettings();
  const formatPrice = useFormatPrice();

  const cancelOrder = useCancelOrder();
  const cancelItem = useCancelOrderItem();
  // M4 — track per-item single-tap cancel state for the inline confirm
  // dialog. The slider modal stays available via a separate "Cancel
  // partial" affordance for items with quantity > 1, so the common
  // case ("cancel one of three") is two taps instead of five.
  const [cancelOneConfirm, setCancelOneConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const cancelOneConfirmRef = useRef<HTMLDivElement | null>(null);
  const createWaiterCall = useCreateWaiterCall();
  // H6 — server-side gate for the Call Staff button. Mirrors the FAB
  // in the table layout; both surfaces share the open-call query
  // cache key so a chip-flip in one updates the other.
  const { hasOpenCall } = useOpenWaiterCallsForTable(actualTableId || null);
  const eta = useOrderEta(order?.order_items, order?.status, order?.created_at, order?.id);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [showCancelOrderConfirm, setShowCancelOrderConfirm] = useState(false);
  const [cancelItemModal, setCancelItemModal] = useState<{
    id: string;
    name: string;
    quantity: number;
  } | null>(null);
  const [cancelItemQty, setCancelItemQty] = useState(1);
  const [cancelLoading, setCancelLoading] = useState(false);

  // A5 — refs + focus-trap hookups for the two destructive modals.
  // The Esc key closes them and Tab cycles inside the dialog instead
  // of escaping into the page behind.
  const cancelOrderModalRef = useRef<HTMLDivElement | null>(null);
  const cancelItemModalRef = useRef<HTMLDivElement | null>(null);

  // CR3 — dismiss the confirmation overlay on mount. After a mid-overlay
  // refresh the persisted overlay would otherwise render on top of this
  // page until its 15 s auto-dismiss fires; tearing it down explicitly
  // keeps the tracking screen the only thing visible once the customer
  // is here.
  const dismissConfirmation = useOrderConfirmationStore((s) => s.dismiss);
  useEffect(() => {
    dismissConfirmation();
  }, [dismissConfirmation]);

  useFocusTrap(cancelOrderModalRef, {
    active: showCancelOrderConfirm,
    onClose: () => {
      if (!cancelLoading) setShowCancelOrderConfirm(false);
    },
  });
  useFocusTrap(cancelItemModalRef, {
    active: cancelItemModal !== null,
    onClose: () => {
      if (!cancelLoading) {
        setCancelItemModal(null);
        setCancelItemQty(1);
      }
    },
  });
  // M4 — keep the inline cancel-one dialog keyboard-accessible too. Esc
  // closes when not mid-mutation; Tab cycles within the dialog. Mirrors
  // the existing modal patterns so screen-reader behavior is uniform.
  useFocusTrap(cancelOneConfirmRef, {
    active: cancelOneConfirm !== null,
    onClose: () => {
      if (!cancelLoading) setCancelOneConfirm(null);
    },
  });

  // A7 — single mutable announcement string drives an aria-live region
  // so screen readers hear status transitions exactly once. Stacking
  // mount/unmount banners (the legacy approach below) would announce
  // each conditional branch as it appeared, which is too chatty.
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const previousStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!order?.status) return;
    if (previousStatusRef.current === order.status) return;
    // Skip the initial mount — we only want to announce *transitions*,
    // not the value the page loaded with.
    if (previousStatusRef.current !== null) {
      const map: Record<string, string> = {
        pending_approval: t('orderStatus.banner.pendingApproval'),
        new: t('orderStatus.banner.confirmed'),
        preparing: t('orderStatus.banner.preparing'),
        ready: t('orderStatus.banner.ready'),
        served: t('orderStatus.banner.served'),
      };
      const message = map[order.status];
      if (message) setStatusAnnouncement(message);
    }
    previousStatusRef.current = order.status;
  }, [order?.status, t]);

  const isLoading = tableLoading || orderLoading;

  const canCancel = order?.status === 'pending_approval' || order?.status === 'new';

  const handleCallStaff = async () => {
    if (!actualTableId || createWaiterCall.isPending) return;
    // H6 — server-side gate. Pairs with the disabled button below so
    // a programmatic re-fire (focused button + Enter) also no-ops.
    if (hasOpenCall) {
      toast.info(t('callStaff.alreadyNotified'));
      return;
    }
    try {
      await createWaiterCall.mutateAsync({
        tableId: actualTableId,
        callType: 'assistance',
        reason: t('callStaff.reason.assistance'),
        priority: 'normal',
      });
      toast.success(t('callStaff.toastSuccess'));
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('callStaff.toastError'));
    }
  };

  const handleCancelOrder = async () => {
    if (!order?.table_id) return;
    setCancelLoading(true);
    try {
      await cancelOrder.mutateAsync({
        orderId: order.id,
        tableId: order.table_id,
      });
      setShowCancelOrderConfirm(false);
      router.push(`/table/${tableId}/menu`);
    } catch (error) {
      Sentry.captureException(error);
      // H3 — localize the rejection. `customer-web/lib/api-routes` throws
      // a bare `Error` with `body.error` as the message, so `error.message`
      // carries the snake_case sentinel ('order_cancel_too_late',
      // 'order_not_cancellable', 'rate_limited', …) which
      // `localizeErrorMessage` maps to the `errors` i18n namespace. The
      // kitchen-already-started branch pairs the toast with a one-tap
      // "Call a waiter" CTA so the customer has a recovery path.
      const message = error instanceof Error ? error.message : String(error);
      const fallback = t('common.error');
      const localized = localizeErrorMessage(message, fallback);
      if (message === 'order_cancel_too_late') {
        toast.error(localized, {
          action: {
            label: t('orderStatus.callWaiter'),
            onClick: () => {
              setShowCancelOrderConfirm(false);
              handleCallStaff();
            },
          },
          duration: 10_000,
        });
      } else {
        toast.error(localized);
      }
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCancelItem = async () => {
    if (!cancelItemModal || !order?.id || !order?.table_id) return;
    setCancelLoading(true);
    try {
      await cancelItem.mutateAsync({
        orderId: order.id,
        itemId: cancelItemModal.id,
        tableId: order.table_id,
        cancelQty: cancelItemQty,
      });
      setCancelItemModal(null);
      setCancelItemQty(1);
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('common.error'));
    } finally {
      setCancelLoading(false);
    }
  };

  // M4 — inline cancel-one path. The common case is "cancel one"; the
  // pre-fix flow forced every cancellation through the slider modal.
  // Now the X button fires this directly with a single confirm dialog;
  // the slider modal is reserved for items with quantity > 1 via the
  // dedicated "Cancel partial" affordance below.
  const handleCancelOne = async () => {
    if (!cancelOneConfirm || !order?.id || !order?.table_id) return;
    setCancelLoading(true);
    try {
      await cancelItem.mutateAsync({
        orderId: order.id,
        itemId: cancelOneConfirm.id,
        tableId: order.table_id,
        cancelQty: 1,
      });
      setCancelOneConfirm(null);
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('common.error'));
    } finally {
      setCancelLoading(false);
    }
  };

  if (tableNotFound) {
    return <TableNotActiveScreen />;
  }

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">{t('orderStatus.noOrderTitle')}</h1>
          <p className="text-muted-foreground">{t('orderStatus.noOrderSubtext')}</p>
        </div>
        <Button size="lg" onClick={() => router.push(`/table/${tableId}/menu`)}>
          {t('orderStatus.browseMenu')}
        </Button>
      </div>
    );
  }

  const statusSteps = [
    { key: 'pending_approval', label: t('orderStatus.step.awaitingApproval'), icon: Hourglass },
    { key: 'new', label: t('orderStatus.step.orderConfirmed'), icon: CheckCircle2 },
    { key: 'preparing', label: t('orderStatus.step.preparing'), icon: Clock },
    { key: 'ready', label: t('orderStatus.step.ready'), icon: CheckCircle2 },
    { key: 'served', label: t('orderStatus.step.served'), icon: CheckCircle2 },
  ];

  // "served" is a final state — all steps are completed
  const isOrderCompleted = order.status === 'served';

  const getItemStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return t('orderStatus.itemStatus.pending');
      case 'preparing':
        return t('orderStatus.itemStatus.preparing');
      case 'ready':
        return t('orderStatus.itemStatus.ready');
      case 'served':
        return t('orderStatus.itemStatus.served');
      case 'cancelled':
        return t('orderStatus.cancelled');
      default:
        return status;
    }
  };

  const getItemBadgeColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'preparing':
        return 'bg-yellow-50 text-yellow-700 border-yellow-300';
      case 'ready':
        return 'bg-green-50 text-green-700 border-green-300';
      case 'served':
        return 'bg-purple-50 text-purple-700 border-purple-300';
      case 'cancelled':
        return 'bg-red-50 text-red-600 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          {/* A1 — bump Button size="icon" (h-10 w-10) past the 44×44
              WCAG 2.5.5 floor without touching the shared variant. The
              ArrowLeft icon swaps to ArrowRight in RTL via rtl:scale-x. */}
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rtl:[&_svg]:rotate-180"
            aria-label={t('back', { ns: 'common' })}
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">{t('orderStatus.header')}</h1>
          <div className="w-11" />
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* H1 — surfaces websocket disconnects when data is stale.
            Renders only when rtStatus !== 'SUBSCRIBED' AND data is
            >30s old, so a fresh mount doesn't flash a banner during
            the normal CONNECTING → SUBSCRIBED transition. */}
        <ReconnectingBanner
          rtStatus={rtStatus}
          dataUpdatedAt={dataUpdatedAt}
          onRefresh={refreshOrder}
        />

        {/* Order Header */}
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {t('orderStatus.labelOrderNumber')}
            </span>
            <Badge variant="outline">{order.order_number}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('orderStatus.labelTable')}</span>
            <span className="font-medium">{order.table.table_number}</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-muted-foreground">{t('orderStatus.labelPlaced')}</span>
            <span className="font-medium">
              {order.created_at ? timeAgo(order.created_at, t) : '—'}
            </span>
          </div>
        </div>

        {/* A7 — single polite live region for status transitions. We keep
            the existing colored banners below for sighted users; this
            element is visually hidden and only narrates the change. */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {statusAnnouncement}
        </div>

        {/* Status Timeline */}
        <div className="bg-card rounded-lg p-6 border">
          <h2 className="font-semibold mb-4">{t('orderStatus.progressTitle')}</h2>
          <OrderTimeline
            steps={statusSteps}
            currentStatus={order.status}
            inProgressLabel={t('orderStatus.inProgress')}
            isOrderCompleted={isOrderCompleted}
          />

          {/* M6 — customer-facing ETA. Null when any item lacks
              preparation_time OR the order isn't actively in-flight,
              so the legacy status banners below still cover the
              fallback ("We're preparing your order"). The hook ticks
              every 30s while in `preparing` so the countdown decays
              without re-fetching the order. */}
          {eta && (
            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <p className="text-sm text-center font-medium text-emerald-800 dark:text-emerald-200">
                {eta.almostReady
                  ? t('orderStatus.eta.almostReady')
                  : t('orderStatus.eta.preparing', { minutes: eta.minutes })}
              </p>
            </div>
          )}

          {order.status === 'pending_approval' && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-center font-medium text-amber-800 dark:text-amber-200">
                ⏳ {t('orderStatus.banner.pendingApproval')}
              </p>
              <p className="text-xs text-center text-amber-600 dark:text-amber-400 mt-1">
                {t('orderStatus.banner.pendingApprovalSub')}
              </p>
            </div>
          )}

          {order.status === 'new' && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-center font-medium text-blue-800 dark:text-blue-200">
                ✓ {t('orderStatus.banner.confirmed')}
              </p>
            </div>
          )}

          {order.status === 'preparing' && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <p className="text-sm text-center">🔥 {t('orderStatus.banner.preparing')}</p>
            </div>
          )}

          {order.status === 'ready' && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <p className="text-sm text-center font-medium">✨ {t('orderStatus.banner.ready')}</p>
            </div>
          )}

          {order.status === 'served' && (
            <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-sm text-center font-medium text-purple-800 dark:text-purple-200">
                {t('orderStatus.banner.served')}
              </p>
            </div>
          )}
        </div>

        {/* Order Items */}
        <div className="bg-card rounded-lg p-4 border">
          <h2 className="font-semibold mb-4">{t('orderStatus.orderItemsTitle')}</h2>
          <div className="space-y-3">
            {order.order_items.map((item) => {
              const isCancelled = item.status === 'cancelled';
              return (
                <div
                  key={item.id}
                  className={`flex items-start justify-between pb-3 border-b last:border-0 last:pb-0 ${isCancelled ? 'opacity-50' : ''}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${isCancelled ? 'line-through' : ''}`}>
                        {item.quantity}x
                      </span>
                      <span className={isCancelled ? 'line-through' : ''}>{item.item_name}</span>
                    </div>
                    {item.notes && (
                      <p className="text-sm text-muted-foreground mt-1">📝 {item.notes}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getItemBadgeColor(item.status)}`}
                      >
                        {getItemStatusLabel(item.status)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isCancelled ? 'line-through' : ''}`}>
                      {formatPrice(item.item_price * item.quantity)}
                    </span>
                    {canCancel && !isCancelled && (
                      <>
                        {/* M4 — single-tap cancel-one. Common case
                            ("cancel one of three") now ends in a 2-tap
                            confirm dialog instead of the slider modal.
                            The button label is "Cancel one" on multi-qty
                            items so the affordance is unambiguous. */}
                        <button
                          aria-label={t('orderStatus.cancelOneAria', { name: item.item_name })}
                          onClick={() => setCancelOneConfirm({ id: item.id, name: item.item_name })}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        {/* M4 — "Cancel partial" entry point for the
                            slider modal. Only rendered when there's more
                            than one of this item, since cancelling all
                            of a quantity-1 row is already the X button's
                            job. */}
                        {item.quantity > 1 && (
                          <button
                            aria-label={t('orderStatus.cancelPartialAria', {
                              name: item.item_name,
                            })}
                            onClick={() => {
                              setCancelItemModal({
                                id: item.id,
                                name: item.item_name,
                                quantity: item.quantity,
                              });
                              setCancelItemQty(1);
                            }}
                            className="text-[11px] font-medium text-red-400 hover:text-red-600 hover:underline"
                          >
                            {t('orderStatus.cancelPartial')}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t space-y-2">
            {order.tax > 0 ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('subtotal', { ns: 'common' })}</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {settings?.tax_label || t('orders.tax', { ns: 'staff' })}
                  </span>
                  <span>{formatPrice(order.tax)}</span>
                </div>
              </>
            ) : null}
            <div className="flex justify-between text-lg font-bold">
              <span>{t('total', { ns: 'common' })}</span>
              <span className="text-primary">{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Feedback Form */}
        {showFeedbackForm && (
          <div className="bg-card rounded-lg p-6 border">
            <FeedbackForm
              tableId={actualTableId}
              tenantId={table?.tenant_id || ''}
              orderId={order.id}
              onSuccess={() => setShowFeedbackForm(false)}
              onCancel={() => setShowFeedbackForm(false)}
            />
          </div>
        )}

        {/* Actions */}
        {!showFeedbackForm && (
          <div className="space-y-3">
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleCallStaff}
              disabled={createWaiterCall.isPending || hasOpenCall}
            >
              {createWaiterCall.isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : hasOpenCall ? (
                <CheckCircle2 className="mr-2 h-5 w-5 text-emerald-600" />
              ) : (
                <Bell className="mr-2 h-5 w-5" />
              )}
              {hasOpenCall ? t('callStaff.notifiedTitle') : t('orderStatus.callStaff')}
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => setShowFeedbackForm(true)}
            >
              <MessageSquare className="mr-2 h-5 w-5" />
              {t('orderStatus.sendFeedback')}
            </Button>

            {(order.status === 'pending_approval' || order.status === 'new') && (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => router.push(`/table/${tableId}/menu`)}
              >
                <Plus className="mr-2 h-5 w-5" />
                {t('orderStatus.addMoreItems')}
              </Button>
            )}

            {canCancel && (
              <Button
                variant="outline"
                size="lg"
                className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => setShowCancelOrderConfirm(true)}
              >
                <Trash2 className="mr-2 h-5 w-5" />
                {t('orderStatus.cancelOrder')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Cancel Order Confirmation Modal */}
      {showCancelOrderConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div
            ref={cancelOrderModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-order-title"
            tabIndex={-1}
            className="bg-background rounded-lg max-w-sm w-full p-6 focus:outline-none"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 id="cancel-order-title" className="text-lg font-bold">
                {t('orderStatus.cancelOrder')}
              </h3>
            </div>
            <p className="text-muted-foreground mb-6">{t('orderStatus.cancelOrderConfirm')}</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelOrderConfirm(false)}
                disabled={cancelLoading}
              >
                {t('orderStatus.keepOrder')}
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleCancelOrder}
                disabled={cancelLoading}
              >
                {cancelLoading ? t('orderStatus.cancelling') : t('orderStatus.confirmCancel')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Item Modal */}
      {cancelItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div
            ref={cancelItemModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-item-title"
            tabIndex={-1}
            className="bg-background rounded-lg max-w-sm w-full p-6 focus:outline-none"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <X className="h-6 w-6 text-red-600" />
              </div>
              <h3 id="cancel-item-title" className="text-lg font-bold">
                {t('orderStatus.cancelItem')}
              </h3>
            </div>
            <p className="text-muted-foreground mb-4">
              {t('orderStatus.cancelItemConfirm', { name: cancelItemModal.name })}
            </p>

            {cancelItemModal.quantity > 1 && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  {t('orderStatus.cancelQuantity')}
                </label>
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    aria-label={t('orderStatus.cancelQtyDecreaseAria')}
                    onClick={() => setCancelItemQty(Math.max(1, cancelItemQty - 1))}
                    disabled={cancelItemQty <= 1}
                    className="h-11 w-11 flex items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-2xl font-bold w-12 text-center">{cancelItemQty}</span>
                  <button
                    type="button"
                    aria-label={t('orderStatus.cancelQtyIncreaseAria')}
                    onClick={() =>
                      setCancelItemQty(Math.min(cancelItemModal.quantity, cancelItemQty + 1))
                    }
                    disabled={cancelItemQty >= cancelItemModal.quantity}
                    className="h-11 w-11 flex items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-center text-muted-foreground mt-1">
                  {t('orderStatus.outOf', {
                    count: cancelItemQty,
                    total: cancelItemModal.quantity,
                  })}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setCancelItemModal(null);
                  setCancelItemQty(1);
                }}
                disabled={cancelLoading}
              >
                {t('orderStatus.keepItem')}
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleCancelItem}
                disabled={cancelLoading}
              >
                {cancelLoading ? t('orderStatus.cancelling') : t('orderStatus.confirmCancel')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* M4 — inline cancel-one confirmation dialog. Skipping the
          slider modal turns the common case into a 2-tap operation
          (tap X, confirm) without breaking partial-cancel power-user
          flow which still goes through `cancelItemModal`. */}
      {cancelOneConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div
            ref={cancelOneConfirmRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-one-title"
            tabIndex={-1}
            className="bg-background rounded-lg max-w-sm w-full p-6 focus:outline-none"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <X className="h-6 w-6 text-red-600" />
              </div>
              <h3 id="cancel-one-title" className="text-lg font-bold">
                {t('orderStatus.cancelOneTitle')}
              </h3>
            </div>
            <p className="text-muted-foreground mb-6">
              {t('orderStatus.cancelOneConfirm', { name: cancelOneConfirm.name })}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCancelOneConfirm(null)}
                disabled={cancelLoading}
              >
                {t('orderStatus.keepItem')}
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleCancelOne}
                disabled={cancelLoading}
              >
                {cancelLoading ? t('orderStatus.cancelling') : t('orderStatus.confirmCancel')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Platform Footer */}
      <PlatformFooter className="pb-4" />
    </div>
  );
}
