'use client';

import { calculateOrderTotal, formatElapsedTime } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import {
  AlertCircle,
  CheckCircle,
  ChefHat,
  Clock,
  Edit2,
  Hourglass,
  Loader2,
  MoreVertical,
  Package,
  Trash2,
  UserCheck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
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

// Get effective status based on item statuses
const getEffectiveOrderStatus = (order: OrderWithDetails) => {
  if (!order?.order_items || order.order_items.length === 0) {
    return order.status;
  }

  const items = order.order_items.filter((item) => item.status !== 'cancelled');
  if (items.length === 0) return order.status;

  const allServed = items.every((item) => item.status === 'served');
  const allReady = items.every((item) => item.status === 'ready' || item.status === 'served');
  const anyReady = items.some((item) => item.status === 'ready');
  const anyPreparing = items.some((item) => item.status === 'preparing');

  if (allServed) return 'served';
  if (allReady) return 'ready';
  if (anyReady) return 'partially_ready';
  if (anyPreparing) return 'preparing';
  return order.status;
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
    const effectiveStatus = getEffectiveOrderStatus(activeOrders[0]);
    if (effectiveStatus === 'served') return 'bg-purple-50 border-purple-400';
    if (effectiveStatus === 'ready') return 'bg-green-50 border-green-400';
    if (effectiveStatus === 'partially_ready') return 'bg-lime-50 border-lime-400';
    if (effectiveStatus === 'preparing') return 'bg-yellow-50 border-yellow-400';
    if (effectiveStatus === 'new') return 'bg-blue-50 border-blue-400';
    return 'bg-orange-50 border-orange-300';
  }
  return 'bg-white border-gray-200 hover:border-gray-400 hover:shadow-md';
};

export function TableCard({
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

  const hasMultipleOrders = activeOrders.length > 1;
  const activeOrder: OrderWithDetails | undefined = activeOrders[0];
  const hasActiveCalls = activeCalls.length > 0;

  const combinedTotal = activeOrders.reduce((total, order) => {
    return total + calculateOrderTotal(order);
  }, 0);

  const combinedItemsCount = activeOrders.reduce((count, order) => {
    return count + (order.order_items?.filter((item) => item.status !== 'cancelled').length || 0);
  }, 0);

  // Get order status badge styling
  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return {
          bg: 'bg-amber-100',
          text: 'text-amber-800',
          border: 'border-amber-400',
          icon: <Hourglass className="h-3.5 w-3.5" />,
          label: `⏳ ${t('orders.pendingApproval')}`,
        };
      case 'new':
        return {
          bg: 'bg-blue-100',
          text: 'text-blue-800',
          border: 'border-blue-300',
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          label: t('orders.new'),
        };
      case 'preparing':
        return {
          bg: 'bg-yellow-100',
          text: 'text-yellow-800',
          border: 'border-yellow-300',
          icon: <ChefHat className="h-3.5 w-3.5" />,
          label: t('orders.preparing'),
        };
      case 'ready':
        return {
          bg: 'bg-green-100',
          text: 'text-green-800',
          border: 'border-green-300',
          icon: <CheckCircle className="h-3.5 w-3.5" />,
          label: t('orders.ready'),
        };
      case 'served':
        return {
          bg: 'bg-purple-100',
          text: 'text-purple-800',
          border: 'border-purple-300',
          icon: <UtensilsCrossed className="h-3.5 w-3.5" />,
          label: t('orders.served'),
        };
      case 'partially_ready':
        return {
          bg: 'bg-lime-100',
          text: 'text-lime-800',
          border: 'border-lime-400',
          icon: <CheckCircle className="h-3.5 w-3.5" />,
          label: t('orders.ready'),
        };
      default:
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-800',
          border: 'border-gray-300',
          icon: null,
          label: status,
        };
    }
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
                  onEditTable(table);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <Edit2 className="h-4 w-4" />
                {t('tables.edit')}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTable(table);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-red-600 flex items-center gap-2"
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
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                table.status === 'free'
                  ? 'bg-gray-100 text-gray-600'
                  : table.status === 'occupied'
                    ? 'bg-orange-100 text-orange-700'
                    : table.status === 'reserved'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-200 text-gray-600'
              }`}
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
            onClick={(e) => {
              e.stopPropagation();
              onTransferTable(table);
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
