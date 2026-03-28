'use client';

import type { Database } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { AlertCircle, CheckCircle, ChefHat, UtensilsCrossed, X, XCircle } from 'lucide-react';

type OrderItem = Database['public']['Tables']['order_items']['Row'];

interface OrderItemsListProps {
  items: OrderItem[];
  onItemStatusUpdate: (itemId: string, newStatus: string) => void;
  onCancelItem: (item: OrderItem) => void;
  formatPrice: (amount: number) => string;
}

function getItemStatusBadge(status: string, t: (key: string, opts?: any) => string) {
  switch (status) {
    case 'pending':
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        icon: <AlertCircle className="h-3 w-3" />,
        label: t('pending', { ns: 'common' }),
      };
    case 'preparing':
      return {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        icon: <ChefHat className="h-3 w-3" />,
        label: t('orders.preparing'),
      };
    case 'ready':
      return {
        bg: 'bg-green-100',
        text: 'text-green-800',
        icon: <CheckCircle className="h-3 w-3" />,
        label: t('orders.ready'),
      };
    case 'served':
      return {
        bg: 'bg-purple-100',
        text: 'text-purple-800',
        icon: <UtensilsCrossed className="h-3 w-3" />,
        label: t('orders.served'),
      };
    case 'cancelled':
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        icon: <XCircle className="h-3 w-3" />,
        label: t('orders.cancelled'),
      };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-700', icon: null, label: status };
  }
}

export function OrderItemsList({
  items,
  onItemStatusUpdate,
  onCancelItem,
  formatPrice,
}: OrderItemsListProps) {
  const { t } = useTranslation('staff');

  if (!items || items.length === 0) return null;

  return (
    <div className="mt-4 border-t pt-4">
      <h3 className="font-medium mb-2">{t('orders.currentItems')}</h3>
      <div className="space-y-2">
        {items.map((item: OrderItem) => {
          const statusBadge = getItemStatusBadge(item.status, t);
          const isCancelled = item.status === 'cancelled';

          return (
            <div
              key={item.id}
              className={`flex items-center justify-between text-sm gap-2 py-1 ${isCancelled ? 'opacity-50' : ''}`}
            >
              <span className={`flex-1 ${isCancelled ? 'line-through text-gray-400' : ''}`}>
                {item.quantity}x {item.item_name}
              </span>

              {/* Quick Action Buttons */}
              <div className="flex items-center gap-1.5">
                {isCancelled ? (
                  <span
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}
                  >
                    {statusBadge.icon}
                    {statusBadge.label}
                  </span>
                ) : (
                  <>
                    {(item.status === 'pending' || item.status === 'preparing') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemStatusUpdate(item.id, 'ready');
                        }}
                        className="px-2 py-1 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
                      >
                        <CheckCircle className="h-3 w-3" />
                        {t('orders.ready')}
                      </button>
                    )}
                    {item.status === 'ready' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemStatusUpdate(item.id, 'served');
                        }}
                        className="px-2 py-1 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
                      >
                        <UtensilsCrossed className="h-3 w-3" />
                        {t('orders.served')}
                      </button>
                    )}
                    {item.status === 'served' && (
                      <span
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}
                      >
                        {statusBadge.icon}
                        {t('orders.done')}
                      </span>
                    )}
                    {/* Cancel item button — not shown for served items */}
                    {item.status !== 'served' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCancelItem(item);
                        }}
                        className="px-1.5 py-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                        title={t('orders.cancelItem')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>

              <span
                className={`w-16 text-right ${isCancelled ? 'line-through text-gray-400' : 'text-gray-600'}`}
              >
                {formatPrice(item.quantity * item.item_price)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
