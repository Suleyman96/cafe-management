'use client';

import type { OrderItemStatus } from '@gustri/database/schemas';
import { useTranslation } from '@gustri/i18n';
import { ORDER_ITEM_STATUS_BADGES } from '@gustri/ui-web';
import { CheckCircle, ChevronDown, FileText } from 'lucide-react';
import type { ReactNode } from 'react';
import { ORDER_ITEM_STATUS_ICONS } from '@/lib/enum-icons';
import type { OrderItem, OrderWithRelations } from './use-order-detail';

interface OrderDetailItemsProps {
  order: OrderWithRelations;
  total: number;
  openItemMenu: string | null;
  setOpenItemMenu: (id: string | null) => void;
  onItemStatusUpdate: (itemId: string, newStatus: string) => void;
  formatPrice: (amount: number) => string;
}

export function OrderDetailItems({
  order,
  total,
  openItemMenu,
  setOpenItemMenu,
  onItemStatusUpdate,
  formatPrice,
}: OrderDetailItemsProps) {
  const { t } = useTranslation('staff');

  // Get item status badge — typed lookup; missing variants fail compile.
  const getItemStatusBadge = (status: string) => {
    const config = ORDER_ITEM_STATUS_BADGES[status as OrderItemStatus];
    const Icon = ORDER_ITEM_STATUS_ICONS[status as OrderItemStatus];
    if (!config) return { bg: 'bg-gray-100', text: 'text-gray-700', icon: null, label: status };
    return {
      bg: config.bg,
      text: config.text,
      icon: Icon ? <Icon className="h-3 w-3" /> : null,
      label: t(config.labelKey),
    };
  };

  const itemStatusOptions: Array<{ value: OrderItemStatus; label: string; icon: ReactNode }> = (
    ['pending', 'preparing', 'ready', 'served'] as const
  ).map((value) => {
    const Icon = ORDER_ITEM_STATUS_ICONS[value];
    return {
      value,
      label: t(ORDER_ITEM_STATUS_BADGES[value].labelKey),
      icon: <Icon className="h-3.5 w-3.5" />,
    };
  });

  return (
    <div className="border rounded-lg mb-4 sm:mb-6">
      <div className="border-b px-3 sm:px-4 py-2 sm:py-3">
        <h2 className="font-semibold text-sm sm:text-base">{t('orders.orderItems')}</h2>
      </div>
      <div className="divide-y">
        {order.order_items?.map((item: OrderItem) => {
          const statusBadge = getItemStatusBadge(item.status);
          const isMenuOpen = openItemMenu === item.id;
          const isCancelled = item.status === 'cancelled';

          return (
            <div
              key={item.id}
              className={`px-3 sm:px-4 py-2 sm:py-3 ${isCancelled ? 'opacity-50' : ''}`}
            >
              <div className="flex justify-between items-start gap-2 sm:gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-medium text-sm sm:text-base ${isCancelled ? 'line-through text-gray-400' : ''}`}
                    >
                      {item.quantity}x
                    </span>
                    <span
                      className={`text-sm sm:text-base truncate ${isCancelled ? 'line-through text-gray-400' : ''}`}
                    >
                      {item.menu_item?.name}
                    </span>
                  </div>
                  {item.notes && (
                    <p className="text-xs sm:text-sm text-gray-600 mt-1 flex items-start gap-1">
                      <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      {item.notes}
                    </p>
                  )}
                </div>

                {/* Item Status Badge (no dropdown for cancelled items) */}
                {isCancelled ? (
                  <span
                    className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}
                  >
                    {statusBadge.icon}
                    <span className="hidden xs:inline">{statusBadge.label}</span>
                  </span>
                ) : (
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setOpenItemMenu(isMenuOpen ? null : item.id)}
                      className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${statusBadge.bg} ${statusBadge.text} hover:opacity-80`}
                    >
                      {statusBadge.icon}
                      <span className="hidden xs:inline">{statusBadge.label}</span>
                      <ChevronDown
                        className={`h-3 w-3 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[140px]">
                        {itemStatusOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => onItemStatusUpdate(item.id, option.value)}
                            disabled={item.status === option.value}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                              item.status === option.value
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            {option.icon}
                            {option.label}
                            {item.status === option.value && (
                              <CheckCircle className="h-3 w-3 ml-auto text-green-500" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="text-right flex-shrink-0">
                  <p className={`font-medium ${isCancelled ? 'line-through text-gray-400' : ''}`}>
                    {formatPrice(item.quantity * item.item_price)}
                  </p>
                  <p
                    className={`text-sm ${isCancelled ? 'line-through text-gray-400' : 'text-gray-600'}`}
                  >
                    {formatPrice(item.item_price)} {t('each', { ns: 'common' })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t px-4 py-3 space-y-2">
        {order &&
          (order.tax > 0 || (order.discount_amount ?? 0) > 0 || (order.delivery_fee ?? 0) > 0) && (
            <>
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>{t('subtotal', { ns: 'common' })}</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              {(order.discount_amount ?? 0) > 0 && (
                <div className="flex justify-between items-center text-sm text-red-600">
                  <span>
                    {t('orders.discount')} (
                    {order.discount_type === 'percentage'
                      ? `${order.discount_value}%`
                      : formatPrice(order.discount_value ?? 0)}
                    )
                  </span>
                  <span>-{formatPrice(order.discount_amount ?? 0)}</span>
                </div>
              )}
              {order.tax > 0 && (
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>{t('orders.tax')}</span>
                  <span>{formatPrice(order.tax)}</span>
                </div>
              )}
              {order.order_type === 'delivery' && (order.delivery_fee ?? 0) > 0 && (
                <div className="flex justify-between items-center text-sm text-purple-600">
                  <span>{t('deliveryFee', { ns: 'common' })}</span>
                  <span>{formatPrice(order.delivery_fee ?? 0)}</span>
                </div>
              )}
            </>
          )}
        <div
          className={`flex justify-between items-center text-lg font-semibold ${order && order.tax > 0 ? 'pt-2 border-t' : ''}`}
        >
          <span>{t('total', { ns: 'common' })}</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>
    </div>
  );
}
