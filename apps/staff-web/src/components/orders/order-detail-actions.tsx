'use client';

import type { ORDER_STATUS } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { Button, LoadingSpinner } from '@gustri/ui';
import {
  AlertTriangle,
  CheckCircle,
  ChefHat,
  CreditCard,
  Percent,
  RotateCcw,
  Smartphone,
  ThumbsUp,
  Truck,
  XCircle,
} from 'lucide-react';
import { usePendingAction } from '@/hooks/use-pending-action';

// Per-button pending keys. The connectivity gate (`canMutate`) is orthogonal
// — it disables every button when offline; pending only locks the specific
// action that's mid-flight.
type ActionKey =
  | 'approve'
  | 'prepare'
  | 'ready'
  | 'serve'
  | 'out_for_delivery'
  | 'delivered'
  | 'pay'
  | 'close'
  | 'closeUnpaid'
  | 'discount'
  | 'refund'
  | 'cancel';

interface OrderDetailActionsProps {
  order: {
    status: string;
    order_type?: string | null;
    source?: string | null;
    table?: { table_number: string } | null;
  };
  isFullyPaid: boolean;
  hasItems?: boolean;
  /** Connectivity gate from `useIsOnline()` — disables all buttons when offline. */
  canMutate?: boolean;
  // Async callback: the parent uses `mutateAsync`, so the returned promise
  // resolves once the mutation settles. `run` awaits it to release the
  // per-button pending lock on settle.
  onStatusUpdate: (status: keyof typeof ORDER_STATUS) => Promise<unknown>;
  onOpenPayment: () => void;
  onOpenDiscount?: () => void;
  canDiscount?: boolean;
  onOpenRefund?: () => void;
  canRefund?: boolean;
  /**
   * Opens the "close unpaid" guard modal. Renders an amber warning-style
   * button alongside the regular Pay flow when the order has reached a
   * service state (served / ready / out_for_delivery / delivered) but
   * the balance isn't settled. Required to surface the explicit
   * write-off path (comp / walk-out / staff meal) that powers shift
   * reconciliation. Optional so unrelated callers (e.g. order cards
   * elsewhere) don't have to wire it.
   */
  onOpenCloseUnpaid?: () => void;
}

export function OrderDetailActions({
  order,
  isFullyPaid,
  hasItems = true,
  canMutate = true,
  onStatusUpdate,
  onOpenPayment,
  onOpenDiscount,
  canDiscount = false,
  onOpenRefund,
  canRefund = false,
  onOpenCloseUnpaid,
}: OrderDetailActionsProps) {
  const { t } = useTranslation('staff');
  const { isPending, run } = usePendingAction<ActionKey>();
  const canAdvance = hasItems && canMutate;

  const fireStatus = (key: ActionKey, status: keyof typeof ORDER_STATUS) =>
    run(key, async () => {
      await onStatusUpdate(status);
    });

  // Modal openers go through `run` too so a double-tap doesn't open twice
  // before React commits the state that hides the button.
  const openModal = (key: ActionKey, open: () => void) =>
    run(key, async () => {
      open();
    });

  const spinner = <LoadingSpinner size="sm" className="border-white/40 border-t-white" />;
  const outlineSpinner = <LoadingSpinner size="sm" className="border-gray-300 border-t-gray-700" />;

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      {!canAdvance && ['pending_approval', 'new', 'preparing'].includes(order.status) && (
        <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200 w-full">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t('orders.addItemsBeforeAdvancing')}
        </span>
      )}
      {/* Pending Approval: Show approve button */}
      {order.status === 'pending_approval' && (
        <>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 flex items-center gap-1 sm:gap-2"
            onClick={() => fireStatus('approve', 'NEW')}
            disabled={!canMutate || isPending('approve')}
          >
            {isPending('approve') ? spinner : <ThumbsUp className="h-4 w-4" />}
            {t('approve', { ns: 'common' })}
          </Button>
          {order.source === 'customer' && (
            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
              <Smartphone className="h-3 w-3" />
              {t('orders.qrOrder')}
            </span>
          )}
        </>
      )}
      {order.status === 'new' && (
        <Button
          size="sm"
          onClick={() => fireStatus('prepare', 'PREPARING')}
          disabled={!canAdvance || isPending('prepare')}
          className="flex items-center gap-1 sm:gap-2"
        >
          {isPending('prepare') ? spinner : <ChefHat className="h-4 w-4" />}
          {t('orders.startPreparing')}
        </Button>
      )}
      {order.status === 'preparing' && (
        <Button
          size="sm"
          onClick={() => fireStatus('ready', 'READY')}
          disabled={!canAdvance || isPending('ready')}
          className="flex items-center gap-1 sm:gap-2"
        >
          {isPending('ready') ? spinner : <CheckCircle className="h-4 w-4" />}
          {t('orders.ready')}
        </Button>
      )}
      {order.status === 'ready' && order.order_type === 'dine_in' && (
        <Button
          size="sm"
          onClick={() => fireStatus('serve', 'SERVED')}
          disabled={!canAdvance || isPending('serve')}
          className="flex items-center gap-1 sm:gap-2"
        >
          {isPending('serve') ? spinner : <CheckCircle className="h-4 w-4" />}
          {t('orders.served')}
        </Button>
      )}
      {/* Delivery: Out for Delivery when ready */}
      {order.status === 'ready' && order.order_type === 'delivery' && (
        <Button
          size="sm"
          onClick={() => fireStatus('out_for_delivery', 'OUT_FOR_DELIVERY')}
          disabled={!canAdvance || isPending('out_for_delivery')}
          className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1 sm:gap-2"
        >
          {isPending('out_for_delivery') ? spinner : <Truck className="h-4 w-4" />}
          {t('orders.outForDelivery')}
        </Button>
      )}
      {/* Delivery: Mark Delivered */}
      {order.status === 'out_for_delivery' && order.order_type === 'delivery' && (
        <Button
          size="sm"
          onClick={() => fireStatus('delivered', 'DELIVERED')}
          disabled={!canAdvance || isPending('delivered')}
          className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 sm:gap-2"
        >
          {isPending('delivered') ? spinner : <CheckCircle className="h-4 w-4" />}
          {t('orders.markDelivered')}
        </Button>
      )}
      {['served', 'ready', 'out_for_delivery', 'delivered'].includes(order.status) &&
        !isFullyPaid && (
          <Button
            data-testid="payment-btn"
            size="sm"
            onClick={() => openModal('pay', onOpenPayment)}
            disabled={!canMutate || isPending('pay')}
            className="flex items-center gap-1 sm:gap-2"
          >
            {isPending('pay') ? spinner : <CreditCard className="h-4 w-4" />}
            {t('orders.payment')}
          </Button>
        )}
      {isFullyPaid && order.status !== 'closed' && order.status !== 'cancelled' && (
        <Button
          size="sm"
          onClick={() => fireStatus('close', 'CLOSED')}
          disabled={!canMutate || isPending('close')}
          className="flex items-center gap-1 sm:gap-2"
        >
          {isPending('close') ? spinner : <CheckCircle className="h-4 w-4" />}
          {t('close', { ns: 'common' })}
        </Button>
      )}
      {/* Close-unpaid guard: only surfaces when service has been performed
          (post-`served` for dine-in, post-`ready` for non-dine-in) but the
          balance isn't settled. Routes through the guard modal so the
          write-off lands in `force_close_reason` for shift reconciliation.
          Pre-service unpaid orders should be cancelled, not closed — that's
          why we don't include `pending_approval` / `new` / `preparing`. */}
      {!isFullyPaid &&
        onOpenCloseUnpaid &&
        ['served', 'ready', 'out_for_delivery', 'delivered'].includes(order.status) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => openModal('closeUnpaid', onOpenCloseUnpaid)}
            disabled={!canMutate || isPending('closeUnpaid')}
            className="flex items-center gap-1 sm:gap-2 text-amber-700 border-amber-300 hover:bg-amber-50"
          >
            {isPending('closeUnpaid') ? (
              <LoadingSpinner size="sm" className="border-amber-200 border-t-amber-700" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {t('orders.closeUnpaid.button')}
          </Button>
        )}
      {canDiscount &&
        onOpenDiscount &&
        !isFullyPaid &&
        !['closed', 'cancelled'].includes(order.status) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => openModal('discount', onOpenDiscount)}
            disabled={isPending('discount')}
            className="flex items-center gap-1 sm:gap-2"
          >
            {isPending('discount') ? outlineSpinner : <Percent className="h-4 w-4" />}
            {t('orders.addDiscount')}
          </Button>
        )}
      {canRefund && onOpenRefund && !['cancelled'].includes(order.status) && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => openModal('refund', onOpenRefund)}
          disabled={isPending('refund')}
          className="flex items-center gap-1 sm:gap-2 text-red-600 border-red-200 hover:bg-red-50"
        >
          {isPending('refund') ? (
            <LoadingSpinner size="sm" className="border-red-200 border-t-red-600" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {t('orders.refund')}
        </Button>
      )}
      {['pending_approval', 'new', 'preparing', 'ready', 'served', 'out_for_delivery'].includes(
        order.status,
      ) && (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => fireStatus('cancel', 'CANCELLED')}
          disabled={isPending('cancel')}
          className="flex items-center gap-1 sm:gap-2"
        >
          {isPending('cancel') ? spinner : <XCircle className="h-4 w-4" />}
          {order.status === 'pending_approval'
            ? t('reject', { ns: 'common' })
            : t('cancel', { ns: 'common' })}
        </Button>
      )}
    </div>
  );
}
