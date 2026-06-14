'use client';

import { calculateOrderTotal, formatDateTime, ORDER_STATUS_KEYS } from '@gustri/core';
import type { OrderWithDetails } from '@gustri/database/types';
import { useLocale, useTranslation } from '@gustri/i18n';
import { Button, getOrderStatusColor } from '@gustri/ui-web';
import {
  CheckCircle,
  ChefHat,
  Clock,
  Map as MapIcon,
  MapPin,
  Phone,
  ThumbsUp,
  Truck,
  User,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { memo } from 'react';

type DeliveryOrder = OrderWithDetails & {
  delivery_person?: { full_name: string } | null;
};

type DeliveryStatus =
  | 'pending_approval'
  | 'new'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

interface DeliveryOrderCardProps {
  order: DeliveryOrder;
  formatPrice: (amount: number) => string;
  onStatusUpdate: (orderId: string, newStatus: DeliveryStatus) => void;
  onMarkOutForDelivery: (orderId: string, deliveryPersonId?: string | null) => void;
  onMarkDelivered: (orderId: string) => void;
  onOpenCancel: (order: DeliveryOrder) => void;
}

function DeliveryOrderCardImpl({
  order,
  formatPrice,
  onStatusUpdate,
  onMarkOutForDelivery,
  onMarkDelivered,
  onOpenCancel,
}: DeliveryOrderCardProps) {
  const { t } = useTranslation('staff');
  const locale = useLocale();
  const router = useRouter();

  const grandTotal = calculateOrderTotal(order);
  const deliveryFee = order.delivery_fee ?? 0;

  return (
    <div
      className="border border-purple-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
      onClick={() => router.push(`/orders/${order.id}`)}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-3">
        <div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Truck className="h-4 sm:h-5 w-4 sm:w-5 text-purple-600" />
            <span
              className={`px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}
            >
              {t(ORDER_STATUS_KEYS[order.status] || order.status)}
            </span>
            {order.order_number && (
              <span className="text-xs text-gray-500">#{order.order_number}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDateTime(order.created_at, locale)}
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
          {deliveryFee > 0 && (
            <div className="text-xs text-gray-500">
              {t('orders.inclDelivery')} {formatPrice(deliveryFee)}{' '}
              {t('deliveryFee', { ns: 'common' }).toLowerCase()}
            </div>
          )}
        </div>
      </div>

      {/* Delivery Address */}
      {order.delivery_address && (
        <div className="mb-3 text-sm text-purple-700 bg-purple-50 rounded px-3 py-2 flex items-start gap-2">
          <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2 flex-1">{order.delivery_address}</span>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 text-purple-500 hover:text-purple-800 transition-colors"
            title={t('delivery.openInMaps')}
          >
            <MapIcon className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* Delivery Person */}
      {order.delivery_person?.full_name && (
        <div className="mb-3 text-sm text-gray-600 flex items-center gap-2">
          <Truck className="h-3.5 w-3.5" />
          <span>
            {t('delivery.driver')} {order.delivery_person.full_name}
          </span>
        </div>
      )}

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
        {order.status === 'ready' && (
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => onMarkOutForDelivery(order.id, order.delivery_person_id ?? undefined)}
          >
            <Truck className="h-4 w-4 mr-1" />
            {t('delivery.outForDelivery')}
          </Button>
        )}
        {order.status === 'out_for_delivery' && (
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => onMarkDelivered(order.id)}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            {t('delivery.markDelivered')}
          </Button>
        )}
        {['pending_approval', 'new', 'preparing', 'ready', 'out_for_delivery'].includes(
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

export const DeliveryOrderCard = memo(DeliveryOrderCardImpl);
