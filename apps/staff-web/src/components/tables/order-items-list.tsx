'use client';

import { formatSelectedOptions } from '@gustri/core';
import type { Database, OrderItemStatus } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { ORDER_ITEM_STATUS_BADGES } from '@gustri/ui-web';
import { CheckCircle, UtensilsCrossed, X } from 'lucide-react';
import { ORDER_ITEM_STATUS_ICONS } from '@/lib/enum-icons';

type OrderItem = Database['public']['Tables']['order_items']['Row'];

interface OrderItemsListProps {
  items: OrderItem[];
  onItemStatusUpdate: (itemId: string, newStatus: string) => void;
  onCancelItem: (item: OrderItem) => void;
  formatPrice: (amount: number) => string;
}

// `pending` reads its label from the `common` namespace here (vs `staff` in
// the badge map) to match the shared "Pending" copy used elsewhere on the
// table view.
const ITEM_LIST_LABEL_OVERRIDES: Partial<Record<OrderItemStatus, { key: string; ns?: string }>> = {
  pending: { key: 'pending', ns: 'common' },
};

function getItemStatusBadge(
  status: string,
  t: (key: string, opts?: Record<string, string | number>) => string,
) {
  const config = ORDER_ITEM_STATUS_BADGES[status as OrderItemStatus];
  const Icon = ORDER_ITEM_STATUS_ICONS[status as OrderItemStatus];
  if (!config) return { bg: 'bg-gray-100', text: 'text-gray-700', icon: null, label: status };
  const override = ITEM_LIST_LABEL_OVERRIDES[status as OrderItemStatus];
  const label = override
    ? t(override.key, override.ns ? { ns: override.ns } : undefined)
    : t(config.labelKey);
  return {
    bg: config.bg,
    text: config.text,
    icon: Icon ? <Icon className="h-3 w-3" /> : null,
    label,
  };
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
          const modifiers = formatSelectedOptions(item.selected_options);

          return (
            <div
              key={item.id}
              className={`flex items-center justify-between text-sm gap-2 py-1 ${isCancelled ? 'opacity-50' : ''}`}
            >
              <span className={`flex-1 ${isCancelled ? 'line-through text-gray-400' : ''}`}>
                {item.quantity}x {item.item_name}
                {modifiers && <span className="block text-xs text-gray-500">{modifiers}</span>}
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
