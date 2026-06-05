'use client';

import { isAppError } from '@gustri/core';
import { localizeErrorMessage, useTranslation } from '@gustri/i18n';
import * as Sentry from '@sentry/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useCancelOrder, useCancelOrderItem, useOrder } from '@/hooks/use-order';
import { useOrderEta } from '@/hooks/use-order-eta';
import { useCafeSettings } from '@/hooks/use-settings';
import { useTable } from '@/hooks/use-table';
import { useCreateWaiterCall, useOpenWaiterCallsForTable } from '@/hooks/use-waiter-call';
import { useOrderConfirmationStore } from '@/store/order-confirmation-store';

/**
 * Controller for the customer order-status (live tracking) screen: table/order
 * data + realtime status, ETA, the destructive cancel flows (whole order,
 * per-item, and single-tap cancel-one) with their localized error handling,
 * the call-staff action, and the modal/focus-trap + aria-live plumbing.
 * Extracted verbatim from OrderStatus — behavior unchanged.
 *
 * `tableId` is the table_number from the URL (e.g. "T01").
 */
export function useOrderStatus(tableId: string) {
  const router = useRouter();
  const { t } = useTranslation('customer');

  // Fetch table to get the actual UUID for database operations
  const { data: table, isLoading: tableLoading, error: tableError } = useTable(tableId);
  const actualTableId = table?.id || '';
  // H5 — staff renamed / deleted this table mid-session.
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
  // M4 — per-item single-tap cancel state for the inline confirm dialog.
  const [cancelOneConfirm, setCancelOneConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const cancelOneConfirmRef = useRef<HTMLDivElement | null>(null);
  const createWaiterCall = useCreateWaiterCall();
  // H6 — server-side gate for the Call Staff button.
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
  const cancelOrderModalRef = useRef<HTMLDivElement | null>(null);
  const cancelItemModalRef = useRef<HTMLDivElement | null>(null);

  // CR3 — dismiss the confirmation overlay on mount.
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
  // M4 — keep the inline cancel-one dialog keyboard-accessible too.
  useFocusTrap(cancelOneConfirmRef, {
    active: cancelOneConfirm !== null,
    onClose: () => {
      if (!cancelLoading) setCancelOneConfirm(null);
    },
  });

  // A7 — single mutable announcement string drives an aria-live region so
  // screen readers hear status transitions exactly once.
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const previousStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!order?.status) return;
    if (previousStatusRef.current === order.status) return;
    // Skip the initial mount — only announce *transitions*.
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
    // H6 — server-side gate.
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
      // H3 — localize the rejection. The kitchen-already-started branch pairs
      // the toast with a one-tap "Call a waiter" CTA so the customer has a
      // recovery path.
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

  // M4 — inline cancel-one path. The slider modal is reserved for items with
  // quantity > 1 via the dedicated "Cancel partial" affordance.
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

  return {
    table,
    order,
    settings,
    formatPrice,
    eta,
    hasOpenCall,
    createWaiterCall,
    cancelOrder,
    cancelItem,
    actualTableId,
    tableNotFound,
    isLoading,
    canCancel,
    rtStatus,
    dataUpdatedAt,
    refreshOrder,
    // modal + inline-confirm state
    cancelOneConfirm,
    setCancelOneConfirm,
    cancelOneConfirmRef,
    showFeedbackForm,
    setShowFeedbackForm,
    showCancelOrderConfirm,
    setShowCancelOrderConfirm,
    cancelItemModal,
    setCancelItemModal,
    cancelItemQty,
    setCancelItemQty,
    cancelLoading,
    cancelOrderModalRef,
    cancelItemModalRef,
    statusAnnouncement,
    // handlers
    handleCallStaff,
    handleCancelOrder,
    handleCancelItem,
    handleCancelOne,
  };
}
