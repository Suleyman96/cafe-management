'use client';

import { calculateOrderTotal, formatElapsedTime } from '@gustri/core';
import type { OrderStatus, TableStatus } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { Button, ORDER_STATUS_BADGES, TABLE_STATUS_BADGES } from '@gustri/ui';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Edit2,
  Loader2,
  MoreVertical,
  Package,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { memo } from 'react';
import { usePendingAction } from '@/hooks/use-pending-action';
import { ORDER_STATUS_ICONS } from '@/lib/enum-icons';
import type { OrderWithDetails, Tables, WaiterCalls } from '@/types';

interface TableCardProps {
  table: Tables;
  activeOrders: OrderWithDetails[];
  activeCalls: WaiterCalls[];
  isAdmin: boolean;
  creatingOrderForTable: string | null;
  tableMenuOpen: string | null;
  onTableMenuToggle: (tableId: string | null) => void;
  onEditTable: (table: Tables) => void;
  onDeleteTable: (table: Tables) => void;
  onTransferTable: (table: Tables) => void;
  formatPrice: (amount: number) => string;
}

// `partially_ready` is a derived UI state — not a real `OrderStatus` enum
// value — used when some items are ready but others are still pending. The
// badge map below carries it alongside the real statuses.
type EffectiveOrderStatus = OrderStatus | 'partially_ready';

const getEffectiveOrderStatus = (order: OrderWithDetails): EffectiveOrderStatus => {
  if (!order?.order_items || order.order_items.length === 0) {
    return order.status as OrderStatus;
  }

  const items = order.order_items.filter((item) => item.status !== 'cancelled');
  if (items.length === 0) return order.status as OrderStatus;

  const allServed = items.every((item) => item.status === 'served');
  const allReady = items.every((item) => item.status === 'ready' || item.status === 'served');
  const anyReady = items.some((item) => item.status === 'ready');
  const anyPreparing = items.some((item) => item.status === 'preparing');

  if (allServed) return 'served';
  if (allReady) return 'ready';
  if (anyReady) return 'partially_ready';
  if (anyPreparing) return 'preparing';
  return order.status as OrderStatus;
};

// Card background per *effective* status — uses lighter shades than the
// inline status badge for a softer card surface. Keys cover every real
// `OrderStatus` plus the derived `partially_ready` so a new variant fails
// type-check.
const TABLE_CARD_STATUS_STYLES: Record<EffectiveOrderStatus, string> = {
  pending_approval: 'bg-amber-50 border-amber-300',
  new: 'bg-blue-50 border-blue-400',
  preparing: 'bg-yellow-50 border-yellow-400',
  ready: 'bg-green-50 border-green-400',
  partially_ready: 'bg-lime-50 border-lime-400',
  served: 'bg-purple-50 border-purple-400',
  out_for_delivery: 'bg-violet-50 border-violet-300',
  delivered: 'bg-emerald-50 border-emerald-300',
  closed: 'bg-gray-100 border-gray-300',
  cancelled: 'bg-red-50 border-red-300',
};

// Get table card background based on status and orders
const getTableCardStyle = (table: Tables, activeOrders: OrderWithDetails[]) => {
  if (!table.is_active) {
    return 'bg-gray-100 border-gray-300 opacity-60';
  }
  if (table.status === 'closed') {
    return 'bg-gray-200 border-gray-400';
  }
  if (table.status === 'reserved') {
    return 'bg-blue-50 border-blue-300';
  }
  if (table.status === 'occupied' && activeOrders.length > 0) {
    if (activeOrders.length > 1) {
      return 'bg-amber-50 border-amber-400';
    }
    return TABLE_CARD_STATUS_STYLES[getEffectiveOrderStatus(activeOrders[0])];
  }
  return 'bg-white border-gray-200 hover:border-gray-400 hover:shadow-md';
};

function TableCardImpl({
  table,
  activeOrders,
  activeCalls,
  isAdmin,
  creatingOrderForTable,
  tableMenuOpen,
  onTableMenuToggle,
  onEditTable,
  onDeleteTable,
  onTransferTable,
  formatPrice,
}: TableCardProps) {
  const { t } = useTranslation('staff');
  const router = useRouter();
  // Per-button pending lock — protects against rapid taps queuing two
  // transfer-modal opens or two delete confirms before React commits the
  // first state change.
  const { isPending, run } = usePendingAction<'transfer' | 'edit' | 'delete'>();

  const hasMultipleOrders = activeOrders.length > 1;
  const activeOrder: OrderWithDetails | undefined = activeOrders[0];
  const hasActiveCalls = activeCalls.length > 0;

  const combinedTotal = activeOrders.reduce((total, order) => {
    return total + calculateOrderTotal(order);
  }, 0);

  const combinedItemsCount = activeOrders.reduce((count, order) => {
    return count + (order.order_items?.filter((item) => item.status !== 'cancelled').length || 0);
  }, 0);

  // Get order status badge styling — `partially_ready` is the only key that
  // isn't a real `OrderStatus`; everything else flows through the shared map.
  const PARTIALLY_READY_BADGE = {
    bg: 'bg-lime-100',
    text: 'text-lime-800',
    border: 'border-lime-400',
  } as const;

  const getOrderStatusBadge = (status: EffectiveOrderStatus) => {
    if (status === 'partially_ready') {
      return {
        bg: PARTIALLY_READY_BADGE.bg,
        text: PARTIALLY_READY_BADGE.text,
        border: PARTIALLY_READY_BADGE.border,
        icon: <CheckCircle className="h-3.5 w-3.5" />,
        label: t('orders.ready'),
      };
    }
    const config = ORDER_STATUS_BADGES[status];
    const Icon = ORDER_STATUS_ICONS[status];
    const labelText = t(config.labelKey);
    return {
      bg: config.bg,
      text: config.text,
      border: config.border ?? 'border-gray-300',
      icon: Icon ? <Icon className="h-3.5 w-3.5" /> : null,
      label: status === 'pending_approval' ? `⏳ ${labelText}` : labelText,
    };
  };

  return (
    <div
      className={`
        border-2 rounded-xl p-4 cursor-pointer transition-all relative shadow-sm
        ${getTableCardStyle(table, activeOrders)}
        ${hasActiveCalls ? 'ring-2 ring-red-500 ring-offset-2' : ''}
      `}
      onClick={() => {
        if (creatingOrderForTable) return;
        router.push(`/tables/${table.id}`);
      }}
    >
      {/* Admin actions menu */}
      {isAdmin && (
        <div className="absolute top-2 right-2" data-table-menu>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onTableMenuToggle(tableMenuOpen === table.id ? null : table.id);
            }}
            className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
          >
            <MoreVertical className="h-4 w-4 text-gray-500" />
          </button>

          {tableMenuOpen === table.id && (
            <div
              className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[120px]"
              data-table-menu
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  run('edit', async () => {
                    onEditTable(table);
                  });
                }}
                disabled={isPending('edit')}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Edit2 className="h-4 w-4" />
                {t('tables.edit')}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  run('delete', async () => {
                    onDeleteTable(table);
                  });
                }}
                disabled={isPending('delete')}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-red-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
                {t('tables.delete')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-800">{table.table_number}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${(() => {
                const cfg = TABLE_STATUS_BADGES[table.status as TableStatus];
                // table-card uses a slightly muted "free" tone (gray rather
                // than the badge map's green) since "free" is the resting
                // state and shouldn't draw the eye.
                if (table.status === 'free') return 'bg-gray-100 text-gray-600';
                return cfg ? `${cfg.bg} ${cfg.text}` : 'bg-gray-200 text-gray-600';
              })()}`}
            >
              {t(`tables.${table.status}`)}
            </span>
            {table.location && <span className="text-xs text-gray-500">{table.location}</span>}
          </div>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <Users className="h-3 w-3" />
            {table.capacity} {t('tables.seats')}
          </p>
        </div>
        {hasActiveCalls && (
          <div className="bg-red-500 text-white p-2 rounded-full animate-bounce">
            <AlertCircle className="h-5 w-5" />
          </div>
        )}
      </div>

      {/* Active Order Info */}
      {activeOrders.length > 0 && (
        <div className="space-y-3 border-t border-gray-200/50 pt-3 mt-3">
          {hasMultipleOrders && (
            <div className="bg-amber-100 border border-amber-300 rounded-lg px-3 py-1.5 text-sm font-medium text-amber-800 flex items-center gap-2">
              <Package className="h-4 w-4" />
              {activeOrders.length} {t('tables.ordersOnTable')}
            </div>
          )}

          {/* Order Status Badges */}
          <div className="flex flex-wrap gap-1.5">
            {activeOrders.map((order, index: number) => {
              const orderEffectiveStatus = getEffectiveOrderStatus(order);
              const orderStatusBadge = getOrderStatusBadge(orderEffectiveStatus);
              return (
                <div
                  key={order.id}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${orderStatusBadge.bg} ${orderStatusBadge.text} ${orderStatusBadge.border}`}
                >
                  {orderStatusBadge.icon}
                  {hasMultipleOrders
                    ? `#${index + 1} ${orderStatusBadge.label}`
                    : orderStatusBadge.label}
                </div>
              );
            })}
          </div>

          {/* Order Details Grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="h-4 w-4 text-gray-400" />
              <span>{activeOrder && formatElapsedTime(activeOrder.created_at)}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Package className="h-4 w-4 text-gray-400" />
              <span>
                {combinedItemsCount} {t('tables.items')}
              </span>
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2">
            <span className="text-sm text-gray-600">
              {hasMultipleOrders ? t('tables.combinedTotal') : t('total', { ns: 'common' })}
            </span>
            <span className="text-lg font-bold text-gray-800">{formatPrice(combinedTotal)}</span>
          </div>

          {/* Individual Order Totals (if multiple) */}
          {hasMultipleOrders && (
            <div className="text-xs text-gray-500 space-y-0.5">
              {activeOrders.map((order, index: number) => (
                <div key={order.id} className="flex justify-between">
                  <span>{t('tables.orderNumber', { number: index + 1 })}</span>
                  <span>{formatPrice(calculateOrderTotal(order))}</span>
                </div>
              ))}
            </div>
          )}

          {/* Order Taken By */}
          {activeOrder?.assigned_waiter && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <UserCheck className="h-4 w-4 text-green-500" />
              <span>
                {t('tables.takenBy')} {activeOrder.assigned_waiter.full_name}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Waiter Calls */}
      {activeCalls.map((call) => (
        <div key={call.id} className="mt-3 p-3 bg-red-100 border border-red-300 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="font-semibold text-red-700 text-sm">
              {t(`calls.${call.reason}`, { defaultValue: call.reason })}
            </span>
          </div>
          {call.notes && <p className="text-red-600 text-sm mt-1">{call.notes}</p>}
        </div>
      ))}

      {/* Actions */}
      {creatingOrderForTable === table.id ? (
        <div className="flex items-center justify-center gap-2 mt-4 text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t('tables.creatingOrder')}</span>
        </div>
      ) : table.status === 'occupied' ? (
        <div className="flex gap-2 mt-4">
          <Button
            size="sm"
            variant="outline"
            disabled={isPending('transfer')}
            onClick={(e) => {
              e.stopPropagation();
              run('transfer', async () => {
                onTransferTable(table);
              });
            }}
            className="flex-1"
          >
            {t('tables.transfer')}
          </Button>
        </div>
      ) : (
        table.status === 'free' && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center">{t('tables.clickToView')}</p>
          </div>
        )
      )}
    </div>
  );
}

export const TableCard = memo(TableCardImpl);
