'use client';

import { calculateOrderTotal, formatTime, ORDER_STATUS_KEYS } from '@gustri/core';
import type { OrderWithDetails } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { Button, getOrderStatusColor } from '@gustri/ui-web';
import {
  CheckCircle,
  ChefHat,
  Clock,
  CreditCard,
  Package,
  Phone,
  ThumbsUp,
  User,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { memo } from 'react';

const calculatePaidAmount = (order: OrderWithDetails) => {
  const payments = (order as OrderWithDetails & { order_payments?: { amount: number }[] })
    .order_payments;
  if (!payments) return 0;
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
};

type TakeoutStatus = 'pending_approval' | 'new' | 'preparing' | 'ready' | 'closed' | 'cancelled';

interface TakeoutOrderCardProps {
  order: OrderWithDetails;
  formatPrice: (amount: number) => string;
  onStatusUpdate: (orderId: string, newStatus: TakeoutStatus) => void;
  onOpenPayment: (order: OrderWithDetails) => void;
  onOpenCancel: (order: OrderWithDetails) => void;
}

function TakeoutOrderCardImpl({
  order,
  formatPrice,
  onStatusUpdate,
  onOpenPayment,
  onOpenCancel,
}: TakeoutOrderCardProps) {
  const { t } = useTranslation('staff');
  const router = useRouter();

  const grandTotal = calculateOrderTotal(order);
  const paid = calculatePaidAmount(order);
  const remaining = grandTotal - paid;
  const isFullyPaid = remaining === 0 && grandTotal > 0;

  return (
    <div
      className="border border-orange-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
      onClick={() => router.push(`/orders/${order.id}`)}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-3">
        <div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Package className="h-4 sm:h-5 w-4 sm:w-5 text-orange-600" />
            <span
              className={`px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}
            >
              {order.status === 'ready'
                ? t('takeout.readyForPickup')
                : t(ORDER_STATUS_KEYS[order.status] || order.status)}
            </span>
            {order.order_number && (
              <span className="text-xs text-gray-500">#{order.order_number}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(order.created_at)}
            </span>
            {order.customer_name && (
              <span className="flex items-center gap-1 font-medium">
                <User className="h-3 w-3" />
                {order.customer_name}
              </span>
            )}
            {order.customer_phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {order.customer_phone}
              </span>
            )}
          </div>
        </div>

        <div className="text-left sm:text-right">
          <div className="text-base sm:text-lg font-semibold">{formatPrice(grandTotal)}</div>
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
            {item.quantity}x {item.menu_item?.name || item.item_name}
            {item.notes && <span className="text-xs text-gray-500"> ({item.notes})</span>}
          </div>
        ))}
        {order.order_items?.length > 3 && (
          <div className="text-gray-400">
            {t('orders.moreItems', { count: order.order_items.length - 3 })}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
        {order.status === 'pending_approval' && (
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => onStatusUpdate(order.id, 'new')}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            {t('approve', { ns: 'common' })}
          </Button>
        )}
        {order.status === 'new' && (
          <Button size="sm" variant="outline" onClick={() => onStatusUpdate(order.id, 'preparing')}>
            <ChefHat className="h-4 w-4 mr-1" />
            {t('orders.startPreparing')}
          </Button>
        )}
        {order.status === 'preparing' && (
          <Button size="sm" variant="outline" onClick={() => onStatusUpdate(order.id, 'ready')}>
            <CheckCircle className="h-4 w-4 mr-1" />
            {t('orders.ready')}
          </Button>
        )}
        {order.status === 'ready' && !isFullyPaid && (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPayment(order);
            }}
          >
            <CreditCard className="h-4 w-4 mr-1" />
            {t('orders.payment')}
          </Button>
        )}
        {order.status === 'ready' && isFullyPaid && (
          <Button
            size="sm"
            className="bg-orange-600 hover:bg-orange-700 text-white"
            onClick={() => onStatusUpdate(order.id, 'closed')}
          >
            <Package className="h-4 w-4 mr-1" />
            {t('kitchen.pickedUp')}
          </Button>
        )}
        {['pending_approval', 'new', 'preparing', 'ready'].includes(order.status) && (
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

export const TakeoutOrderCard = memo(TakeoutOrderCardImpl);
