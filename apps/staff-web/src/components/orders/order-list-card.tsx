'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
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

type OrderStatus =
  | 'pending_approval'
  | 'new'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'out_for_delivery'
  | 'delivered'
  | 'paid'
  | 'cancelled';

interface OrderListCardProps {
  order: any;
  formatPrice: (amount: number) => string;
  onStatusUpdate: (orderId: string, newStatus: OrderStatus) => void;
  onOpenPayment: (order: any) => void;
  onOpenCancel: (order: any) => void;
}

const calculateOrderTotal = (order: any) => {
  if (order?.total) return order.total;
  if (!order?.order_items) return 0;
  return order.order_items.reduce(
    (sum: number, item: any) => sum + item.quantity * item.item_price,
    0,
  );
};

const calculatePaidAmount = (order: any) => {
  if (!order?.order_payments) return 0;
  return order.order_payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
};

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusColor = (status: OrderStatus) => {
  switch (status) {
    case 'pending_approval':
      return 'bg-amber-100 text-amber-800 border border-amber-300';
    case 'new':
      return 'bg-blue-100 text-blue-800';
    case 'preparing':
      return 'bg-yellow-100 text-yellow-800';
    case 'ready':
      return 'bg-green-100 text-green-800';
    case 'served':
      return 'bg-purple-100 text-purple-800';
    case 'out_for_delivery':
      return 'bg-violet-100 text-violet-800';
    case 'delivered':
      return 'bg-emerald-100 text-emerald-800';
    case 'paid':
      return 'bg-gray-100 text-gray-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export function OrderListCard({
  order,
  formatPrice,
  onStatusUpdate,
  onOpenPayment,
  onOpenCancel,
}: OrderListCardProps) {
  const { t } = useTranslation('staff');

  const total = calculateOrderTotal(order);
  const paid = calculatePaidAmount(order);
  const remaining = total - paid;
  const isFullyPaid = remaining === 0 && total > 0;
  const hasItems = order.order_items?.some((item: any) => item.status !== 'cancelled') ?? false;

  const isTakeout =
    order.order_type === 'takeout' || (!order.table && order.order_type !== 'delivery');
  const isDelivery = order.order_type === 'delivery';

  return (
    <div
      className={`border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer ${
        isDelivery
          ? 'border-purple-300 bg-purple-50'
          : isTakeout
            ? 'border-orange-300 bg-orange-50'
            : 'border-gray-200 bg-white'
      }`}
      onClick={() => (window.location.href = `/orders/${order.id}`)}
    >
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-3">
        <div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {isDelivery ? (
              <div className="flex items-center gap-2">
                <Truck className="h-4 sm:h-5 w-4 sm:w-5 text-purple-600" />
                <h3 className="font-semibold text-base sm:text-lg text-purple-800">
                  {t('orders.delivered').replace(/d$/, 'y')}
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
              className={`px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
            >
              {order.status.toUpperCase()}
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
        {order.order_items?.slice(0, 3).map((item: any) => (
          <div key={item.id}>
            {item.quantity}x {item.menu_item?.name}
            {item.notes && <span className="text-xs text-gray-500"> ({item.notes})</span>}
          </div>
        ))}
        {order.order_items?.length > 3 && (
          <div className="text-gray-400">+{order.order_items.length - 3} more items</div>
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
              onClick={() => onStatusUpdate(order.id, 'new')}
            >
              <ThumbsUp className="h-4 w-4 mr-1" />
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
            disabled={!hasItems}
            onClick={() => onStatusUpdate(order.id, 'preparing')}
          >
            <ChefHat className="h-4 w-4 mr-1" />
            <span className="hidden xs:inline">{t('orders.startPreparing')}</span>
            <span className="xs:hidden">{t('orders.preparing')}</span>
          </Button>
        )}
        {order.status === 'preparing' && (
          <Button
            size="sm"
            variant="outline"
            disabled={!hasItems}
            onClick={() => onStatusUpdate(order.id, 'ready')}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            {t('orders.ready')}
          </Button>
        )}
        {order.status === 'ready' && order.table && !isDelivery && (
          <Button
            size="sm"
            variant="outline"
            disabled={!hasItems}
            onClick={() => onStatusUpdate(order.id, 'served')}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            {t('orders.served')}
          </Button>
        )}
        {order.status === 'ready' && isDelivery && (
          <Button
            size="sm"
            disabled={!hasItems}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => onStatusUpdate(order.id, 'out_for_delivery')}
          >
            <Truck className="h-4 w-4 mr-1" />
            {t('orders.outForDelivery')}
          </Button>
        )}
        {order.status === 'out_for_delivery' && isDelivery && (
          <Button
            size="sm"
            disabled={!hasItems}
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => onStatusUpdate(order.id, 'delivered')}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            {t('orders.markDelivered')}
          </Button>
        )}
        {order.status === 'ready' && !order.table && !isDelivery && !isFullyPaid && (
          <Button size="sm" onClick={() => onOpenPayment(order)}>
            <CreditCard className="h-4 w-4 mr-1" />
            {t('orders.payment')}
          </Button>
        )}
        {order.status === 'served' && !isFullyPaid && (
          <Button size="sm" onClick={() => onOpenPayment(order)}>
            <CreditCard className="h-4 w-4 mr-1" />
            {t('orders.payment')}
          </Button>
        )}
        {['pending_approval', 'new', 'preparing', 'ready', 'served', 'out_for_delivery'].includes(
          order.status,
        ) && (
          <Button size="sm" variant="destructive" onClick={() => onOpenCancel(order)}>
            <XCircle className="h-4 w-4 mr-1" />
            {order.status === 'pending_approval'
              ? t('reject', { ns: 'common' })
              : t('cancel', { ns: 'common' })}
          </Button>
        )}
      </div>
    </div>
  );
}
