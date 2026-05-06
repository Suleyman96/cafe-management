'use client';

import { calculateOrderTotal, formatTime, ORDER_STATUS_KEYS } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { Button, getOrderStatusColor, LoadingSpinner } from '@gustri/ui';
import {
  CheckCircle,
  ChefHat,
  Clock,
  CreditCard,
  Package,
  Smartphone,
  ThumbsUp,
  Truck,
  User,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { memo } from 'react';
import { usePendingAction } from '@/hooks/use-pending-action';
import type { OrderWithDetails } from '@/types';

type OrderStatus =
  | 'pending_approval'
  | 'new'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

// Per-button keys scoped within this row. Multiple OrderListCard instances
// each own their own pending state, so a status update on row A never
// disables row B.
type ActionKey = 'approve' | 'prepare' | 'ready' | 'serve' | 'deliver' | 'pay' | 'cancel';

interface OrderListCardProps {
  order: OrderWithDetails;
  formatPrice: (amount: number) => string;
  // Async callback so the per-button pending lock releases on settle.
  // Parents use `mutateAsync`, which returns a Promise.
  onStatusUpdate: (orderId: string, newStatus: OrderStatus) => Promise<unknown>;
  onOpenPayment: (order: OrderWithDetails) => void;
  onOpenCancel: (order: OrderWithDetails) => void;
}

const calculatePaidAmount = (
  order: OrderWithDetails & { order_payments?: Array<{ amount: number }> },
) => {
  if (!order?.order_payments) return 0;
  return order.order_payments.reduce((sum, payment) => sum + payment.amount, 0);
};

function OrderListCardImpl({
  order,
  formatPrice,
  onStatusUpdate,
  onOpenPayment,
  onOpenCancel,
}: OrderListCardProps) {
  const { t } = useTranslation('staff');
  const router = useRouter();
  const { isPending, run } = usePendingAction<ActionKey>();

  const total = calculateOrderTotal(order);
  const paid = calculatePaidAmount(order);
  const remaining = total - paid;
  const isFullyPaid = remaining === 0 && total > 0;
  const hasItems = order.order_items?.some((item) => item.status !== 'cancelled') ?? false;

  const isTakeout =
    order.order_type === 'takeout' || (!order.table && order.order_type !== 'delivery');
  const isDelivery = order.order_type === 'delivery';

  const fireStatus = (key: ActionKey, status: OrderStatus) =>
    run(key, async () => {
      await onStatusUpdate(order.id, status);
    });

  const openModal = (key: ActionKey, fn: () => void) =>
    run(key, async () => {
      fn();
    });

  const buttonSpinner = (
    <LoadingSpinner size="sm" className="h-4 w-4 mr-1 border-current border-t-transparent" />
  );

  return (
    <div
      className={`border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer ${
        isDelivery
          ? 'border-purple-300 bg-purple-50'
          : isTakeout
            ? 'border-orange-300 bg-orange-50'
            : 'border-gray-200 bg-white'
      }`}
      onClick={() => router.push(`/orders/${order.id}`)}
    >
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-3">
        <div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {isDelivery ? (
              <div className="flex items-center gap-2">
                <Truck className="h-4 sm:h-5 w-4 sm:w-5 text-purple-600" />
                <h3 className="font-semibold text-base sm:text-lg text-purple-800">
                  {t('orders.delivery')}
                </h3>
              </div>
            ) : isTakeout ? (
              <div className="flex items-center gap-2">
                <Package className="h-4 sm:h-5 w-4 sm:w-5 text-orange-600" />
                <h3 className="font-semibold text-base sm:text-lg text-orange-800">
                  {t('orders.takeout')}
                </h3>
              </div>
            ) : (
              <h3 className="font-semibold text-base sm:text-lg">{order.table.table_number}</h3>
            )}
            <span
              className={`px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}
            >
              {t(ORDER_STATUS_KEYS[order.status] || order.status)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-xs sm:text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(order.created_at)}
            </span>
            {order.customer_name && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {order.customer_name}
              </span>
            )}
            {order.assigned_waiter && (
              <span className="flex items-center gap-1 text-green-600">
                <UserCheck className="h-3 w-3" />
                <span className="hidden sm:inline">{order.assigned_waiter.full_name}</span>
                <span className="sm:hidden">{order.assigned_waiter.full_name.split(' ')[0]}</span>
              </span>
            )}
            <span className="text-xs hidden sm:inline">#{order.id.slice(0, 8)}</span>
          </div>
        </div>

        <div className="text-left sm:text-right flex sm:block items-center gap-3 sm:gap-0">
          <div className="text-base sm:text-lg font-semibold">{formatPrice(total)}</div>
          {isDelivery && (order.delivery_fee ?? 0) > 0 && (
            <div className="text-xs text-gray-500">
              {t('orders.inclDelivery')} {formatPrice(order.delivery_fee)}{' '}
              {t('deliveryFee', { ns: 'common' }).toLowerCase()}
            </div>
          )}
          {paid > 0 && (
            <div className="text-xs sm:text-sm text-green-600">
              {t('orders.paidAmount')} {formatPrice(paid)}
            </div>
          )}
          {remaining > 0 && paid > 0 && (
            <div className="text-xs sm:text-sm text-orange-600">
              {t('orders.dueAmount')} {formatPrice(remaining)}
            </div>
          )}
        </div>
      </div>

      {/* Order Items Preview */}
      <div className="mb-3 text-sm text-gray-600">
        {order.order_items?.slice(0, 3).map((item) => (
          <div key={item.id}>
            {item.quantity}x {item.menu_item?.name}
            {item.notes && <span className="text-xs text-gray-500"> ({item.notes})</span>}
          </div>
        ))}
        {order.order_items?.length > 3 && (
          <div className="text-gray-400">
            {t('orders.moreItems', { count: order.order_items.length - 3 })}
          </div>
        )}
      </div>

      {/* Delivery Address Preview */}
      {isDelivery && order.delivery_address && (
        <div className="mb-3 text-sm text-purple-700 bg-purple-100/50 rounded px-2 py-1.5 flex items-start gap-1.5">
          <Truck className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span className="line-clamp-1">{order.delivery_address}</span>
          {order.delivery_person?.full_name && (
            <span className="text-xs text-purple-500 ml-auto flex-shrink-0">
              {order.delivery_person.full_name}
            </span>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
        {order.status === 'pending_approval' && (
          <>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              disabled={isPending('approve')}
              onClick={() => fireStatus('approve', 'new')}
            >
              {isPending('approve') ? buttonSpinner : <ThumbsUp className="h-4 w-4 mr-1" />}
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
            variant="outline"
            disabled={!hasItems || isPending('prepare')}
            onClick={() => fireStatus('prepare', 'preparing')}
          >
            {isPending('prepare') ? buttonSpinner : <ChefHat className="h-4 w-4 mr-1" />}
            {t('orders.startPreparing')}
          </Button>
        )}
        {order.status === 'preparing' && (
          <Button
            size="sm"
            variant="outline"
            disabled={!hasItems || isPending('ready')}
            onClick={() => fireStatus('ready', 'ready')}
          >
            {isPending('ready') ? buttonSpinner : <CheckCircle className="h-4 w-4 mr-1" />}
            {t('orders.ready')}
          </Button>
        )}
        {order.status === 'ready' && order.table && !isDelivery && (
          <Button
            size="sm"
            variant="outline"
            disabled={!hasItems || isPending('serve')}
            onClick={() => fireStatus('serve', 'served')}
          >
            {isPending('serve') ? buttonSpinner : <CheckCircle className="h-4 w-4 mr-1" />}
            {t('orders.served')}
          </Button>
        )}
        {order.status === 'ready' && isDelivery && (
          <Button
            size="sm"
            disabled={!hasItems || isPending('deliver')}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => fireStatus('deliver', 'out_for_delivery')}
          >
            {isPending('deliver') ? buttonSpinner : <Truck className="h-4 w-4 mr-1" />}
            {t('orders.outForDelivery')}
          </Button>
        )}
        {order.status === 'out_for_delivery' && isDelivery && (
          <Button
            size="sm"
            disabled={!hasItems || isPending('deliver')}
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => fireStatus('deliver', 'delivered')}
          >
            {isPending('deliver') ? buttonSpinner : <CheckCircle className="h-4 w-4 mr-1" />}
            {t('orders.markDelivered')}
          </Button>
        )}
        {order.status === 'ready' && !order.table && !isDelivery && !isFullyPaid && (
          <Button
            size="sm"
            disabled={isPending('pay')}
            onClick={() => openModal('pay', () => onOpenPayment(order))}
          >
            {isPending('pay') ? buttonSpinner : <CreditCard className="h-4 w-4 mr-1" />}
            {t('orders.payment')}
          </Button>
        )}
        {order.status === 'served' && !isFullyPaid && (
          <Button
            size="sm"
            disabled={isPending('pay')}
            onClick={() => openModal('pay', () => onOpenPayment(order))}
          >
            {isPending('pay') ? buttonSpinner : <CreditCard className="h-4 w-4 mr-1" />}
            {t('orders.payment')}
          </Button>
        )}
        {['pending_approval', 'new', 'preparing', 'ready', 'served', 'out_for_delivery'].includes(
          order.status,
        ) && (
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending('cancel')}
            onClick={() => openModal('cancel', () => onOpenCancel(order))}
          >
            {isPending('cancel') ? buttonSpinner : <XCircle className="h-4 w-4 mr-1" />}
            {order.status === 'pending_approval'
              ? t('reject', { ns: 'common' })
              : t('cancel', { ns: 'common' })}
          </Button>
        )}
      </div>
    </div>
  );
}

export const OrderListCard = memo(OrderListCardImpl);
