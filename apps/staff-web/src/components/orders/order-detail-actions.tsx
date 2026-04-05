'use client';

import type { ORDER_STATUS } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
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

interface OrderDetailActionsProps {
  order: {
    status: string;
    order_type?: string | null;
    source?: string | null;
    table?: any;
  };
  isFullyPaid: boolean;
  hasItems?: boolean;
  onStatusUpdate: (status: keyof typeof ORDER_STATUS) => void;
  onOpenPayment: () => void;
  onOpenDiscount?: () => void;
  canDiscount?: boolean;
  onOpenRefund?: () => void;
  canRefund?: boolean;
}

export function OrderDetailActions({
  order,
  isFullyPaid,
  hasItems = true,
  onStatusUpdate,
  onOpenPayment,
  onOpenDiscount,
  canDiscount = false,
  onOpenRefund,
  canRefund = false,
}: OrderDetailActionsProps) {
  const { t } = useTranslation('staff');
  const canAdvance = hasItems;

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
            onClick={() => onStatusUpdate('NEW')}
          >
            <ThumbsUp className="h-4 w-4" />
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
          onClick={() => onStatusUpdate('PREPARING')}
          disabled={!canAdvance}
          className="flex items-center gap-1 sm:gap-2"
        >
          <ChefHat className="h-4 w-4" />
          {t('orders.startPreparing')}
        </Button>
      )}
      {order.status === 'preparing' && (
        <Button
          size="sm"
          onClick={() => onStatusUpdate('READY')}
          disabled={!canAdvance}
          className="flex items-center gap-1 sm:gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          {t('orders.ready')}
        </Button>
      )}
      {order.status === 'ready' && order.order_type === 'dine_in' && (
        <Button
          size="sm"
          onClick={() => onStatusUpdate('SERVED')}
          disabled={!canAdvance}
          className="flex items-center gap-1 sm:gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          {t('orders.served')}
        </Button>
      )}
      {/* Delivery: Out for Delivery when ready */}
      {order.status === 'ready' && order.order_type === 'delivery' && (
        <Button
          size="sm"
          onClick={() => onStatusUpdate('OUT_FOR_DELIVERY')}
          disabled={!canAdvance}
          className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1 sm:gap-2"
        >
          <Truck className="h-4 w-4" />
          {t('orders.outForDelivery')}
        </Button>
      )}
      {/* Delivery: Mark Delivered */}
      {order.status === 'out_for_delivery' && order.order_type === 'delivery' && (
        <Button
          size="sm"
          onClick={() => onStatusUpdate('DELIVERED')}
          disabled={!canAdvance}
          className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 sm:gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          {t('orders.markDelivered')}
        </Button>
      )}
      {['served', 'ready', 'out_for_delivery', 'delivered'].includes(order.status) &&
        !isFullyPaid && (
          <Button size="sm" onClick={onOpenPayment} className="flex items-center gap-1 sm:gap-2">
            <CreditCard className="h-4 w-4" />
            {t('orders.payment')}
          </Button>
        )}
      {isFullyPaid && order.status !== 'closed' && order.status !== 'cancelled' && (
        <Button
          size="sm"
          onClick={() => onStatusUpdate('CLOSED')}
          className="flex items-center gap-1 sm:gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          {t('close', { ns: 'common' })}
        </Button>
      )}
      {canDiscount &&
        onOpenDiscount &&
        !isFullyPaid &&
        !['closed', 'cancelled'].includes(order.status) && (
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenDiscount}
            className="flex items-center gap-1 sm:gap-2"
          >
            <Percent className="h-4 w-4" />
            {t('orders.addDiscount')}
          </Button>
        )}
      {canRefund && onOpenRefund && !['cancelled'].includes(order.status) && (
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenRefund}
          className="flex items-center gap-1 sm:gap-2 text-red-600 border-red-200 hover:bg-red-50"
        >
          <RotateCcw className="h-4 w-4" />
          {t('orders.refund')}
        </Button>
      )}
      {['pending_approval', 'new', 'preparing', 'ready', 'served', 'out_for_delivery'].includes(
        order.status,
      ) && (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => onStatusUpdate('CANCELLED')}
          className="flex items-center gap-1 sm:gap-2"
        >
          <XCircle className="h-4 w-4" />
          {order.status === 'pending_approval'
            ? t('reject', { ns: 'common' })
            : t('cancel', { ns: 'common' })}
        </Button>
      )}
    </div>
  );
}
