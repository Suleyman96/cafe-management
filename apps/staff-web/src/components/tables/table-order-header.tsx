'use client';

import { ACTIVE_ORDER_STATUSES, formatElapsedTime, ORDER_STATUS_KEYS } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { Button, getOrderStatusColor } from '@gustri/ui-web';
import {
  ArrowLeft,
  ArrowRightLeft,
  Bell,
  CheckCircle,
  ChefHat,
  Clock,
  CreditCard,
  DollarSign,
  Layers,
  Loader2,
  Smartphone,
  ThumbsUp,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { OrderItemsList } from '@/components/tables/order-items-list';
import type { OrderItem, useTableDetail } from '@/components/tables/use-table-detail';

type TableDetail = ReturnType<typeof useTableDetail>;

interface TableOrderHeaderProps {
  table: NonNullable<TableDetail['table']>;
  activeOrder: TableDetail['activeOrder'];
  activeOrders: TableDetail['activeOrders'];
  activeCallsForTable: TableDetail['activeCallsForTable'];
  resolveWaiterCall: TableDetail['resolveWaiterCall'];
  combinedTotal: number;
  orderTotal: number;
  formatPrice: (amount: number) => string;
  selectedOrderIndex: number;
  setSelectedOrderIndex: (index: number) => void;
  onResolveCalls: () => void;
  onShowItemTransfer: () => void;
  onShowCancelModal: () => void;
  onOpenPayment: () => void;
  onStatusUpdate: TableDetail['handleStatusUpdate'];
  onItemStatusUpdate: TableDetail['handleItemStatusUpdate'];
  onCancelItemConfirm: (item: OrderItem) => void;
}

export function TableOrderHeader({
  table,
  activeOrder,
  activeOrders,
  activeCallsForTable,
  resolveWaiterCall,
  combinedTotal,
  orderTotal,
  formatPrice,
  selectedOrderIndex,
  setSelectedOrderIndex,
  onResolveCalls,
  onShowItemTransfer,
  onShowCancelModal,
  onOpenPayment,
  onStatusUpdate,
  onItemStatusUpdate,
  onCancelItemConfirm,
}: TableOrderHeaderProps) {
  const router = useRouter();
  const { t } = useTranslation('staff');

  // Surface partial-payment progress on the table view. Without this the header
  // only shows the order total, so a partial payment looked like "nothing
  // changed". order_payments is loaded by the table's orders query (findAll).
  const orderPaid = (activeOrder?.order_payments ?? []).reduce(
    (sum: number, p: { amount: number }) => sum + (p.amount ?? 0),
    0,
  );
  const orderRemaining = orderTotal - orderPaid;
  // Refunds are final (they don't re-open the balance) — surfaced so "paid"
  // isn't misread when money has been returned.
  const orderRefunded = (activeOrder?.refunds ?? []).reduce(
    (sum: number, r: { amount: number }) => sum + (r.amount ?? 0),
    0,
  );

  return (
    // Content-sized; the parent page wraps this in the scrollable order region,
    // so the header no longer caps/scrolls itself (the menu is a bottom sheet,
    // not an inline panel competing for height).
    <div className="px-3 sm:px-4 pt-4 sm:pt-6 pb-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/tables')}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('back', { ns: 'common' })}</span>
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">{table.table_number}</h1>
          {activeOrder && (
            <span
              className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getOrderStatusColor(activeOrder.status)}`}
            >
              {t(ORDER_STATUS_KEYS[activeOrder.status] || activeOrder.status)}
            </span>
          )}
        </div>
      </div>

      {/* Waiter Call Banner */}
      {activeCallsForTable && activeCallsForTable.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-800">
              {activeCallsForTable[0]?.reason || t('calls.needAssistance')}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-100"
            disabled={resolveWaiterCall.isPending}
            onClick={onResolveCalls}
          >
            {resolveWaiterCall.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <CheckCircle className="h-3 w-3 mr-1" />
            )}
            {t('calls.resolve')}
          </Button>
        </div>
      )}

      {/* Multiple Orders Tab Selector */}
      {activeOrders.length > 1 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              {t('tables.ordersOnThisTable', { count: activeOrders.length })}
            </span>
            <span className="text-sm text-amber-600">
              ({t('tables.combinedTotal')}: {formatPrice(combinedTotal)})
            </span>
          </div>
          {/* Single horizontally-scrollable row so a table with many open
              orders doesn't wrap the tabs into a tall stack that pushes the
              order's items off-screen. Every order stays reachable by scrolling. */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {activeOrders.map((order, index) => {
              const orderItemsTotal =
                order.order_items
                  ?.filter((item: OrderItem) => item.status !== 'cancelled')
                  .reduce(
                    (sum: number, item: OrderItem) => sum + item.quantity * item.item_price,
                    0,
                  ) ?? 0;
              return (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrderIndex(index)}
                  className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedOrderIndex === index
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-amber-700 hover:bg-amber-100 border border-amber-300'
                  }`}
                >
                  {/* Label by the stable order_number, not the position index —
                      otherwise cancelling an order just re-indexes the rest and
                      it looks like nothing changed (all the more so when several
                      orders share the same total). */}
                  {order.order_number ? `#${order.order_number}` : `#${index + 1}`} (
                  {formatPrice(orderItemsTotal)})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active order info */}
      {activeOrder && (
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatElapsedTime(activeOrder.created_at)}
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  {formatPrice(orderTotal)}
                </span>
                {/* Partial-payment progress (only once something's been paid). */}
                {orderPaid > 0 && (
                  <>
                    <span className="text-green-700">
                      {t('orders.paidAmount')} {formatPrice(orderPaid)}
                    </span>
                    {orderRemaining > 0 && (
                      <span className="font-medium text-orange-600">
                        {t('orders.dueAmount')} {formatPrice(orderRemaining)}
                      </span>
                    )}
                  </>
                )}
                {orderRefunded > 0 && (
                  <span className="text-red-600">
                    {t('orders.totalRefundedAmount')} {formatPrice(orderRefunded)}
                  </span>
                )}
                {/* Order Taken By */}
                {activeOrder.assigned_waiter && (
                  <span className="flex items-center gap-1">
                    <UserCheck className="h-4 w-4 text-green-600" />
                    <span className="text-green-700">
                      {t('orders.takenBy')} {activeOrder.assigned_waiter.full_name}
                    </span>
                  </span>
                )}
              </div>
              {/* Customer Notes */}
              {activeOrder.customer_notes && (
                <div className="mt-2 p-2 bg-amber-100 rounded-lg border border-amber-300">
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">{t('notes', { ns: 'common' })}:</span>{' '}
                    {activeOrder.customer_notes}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Pending Approval: Show approve button and QR indicator */}
              {activeOrder.status === 'pending_approval' && (
                <>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => onStatusUpdate('NEW')}
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    {t('approve', { ns: 'common' })}
                  </Button>
                  {activeOrder.source === 'customer' && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                      <Smartphone className="h-3 w-3" />
                      {t('orders.qrOrder')}
                    </span>
                  )}
                </>
              )}
              {activeOrder.status === 'new' && (
                <Button size="sm" onClick={() => onStatusUpdate('PREPARING')}>
                  <ChefHat className="h-4 w-4 mr-1" />
                  <span className="hidden xs:inline">{t('start', { ns: 'common' })} </span>
                  {t('orders.preparing')}
                </Button>
              )}
              {activeOrder.status === 'preparing' && (
                <Button size="sm" onClick={() => onStatusUpdate('READY')}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  <span className="hidden xs:inline">{t('mark', { ns: 'common' })} </span>
                  {t('orders.ready')}
                </Button>
              )}
              {activeOrder.status === 'ready' && (
                <Button size="sm" onClick={() => onStatusUpdate('SERVED')}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  <span className="hidden xs:inline">{t('mark', { ns: 'common' })} </span>
                  {t('orders.served')}
                </Button>
              )}
              {/* Payment is decoupled from the kitchen status flow: a waiter can
                  collect payment at any point in an active order's life, not only
                  once it's served. The status-advance buttons above drive the
                  kitchen flow; this is its own (green) action. */}
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={onOpenPayment}>
                <CreditCard className="h-4 w-4 mr-1" />
                {t('orders.payment')}
              </Button>
              {/* Transfer Items button */}
              {activeOrder.order_items?.some((i: OrderItem) => i.status !== 'cancelled') && (
                <Button size="sm" variant="outline" onClick={onShowItemTransfer}>
                  <ArrowRightLeft className="h-4 w-4 mr-1" />
                  {t('tables.transferItems')}
                </Button>
              )}
              {/* Cancel/Reject button - available for active orders */}
              {(ACTIVE_ORDER_STATUSES as readonly string[]).includes(activeOrder.status) && (
                <Button size="sm" variant="destructive" onClick={onShowCancelModal}>
                  <XCircle className="h-4 w-4 mr-1" />
                  {activeOrder.status === 'pending_approval'
                    ? t('reject', { ns: 'common' })
                    : t('cancel', { ns: 'common' })}
                </Button>
              )}
            </div>
          </div>

          {/* Current order items */}
          <OrderItemsList
            items={activeOrder.order_items || []}
            onItemStatusUpdate={onItemStatusUpdate}
            onCancelItem={onCancelItemConfirm}
            formatPrice={formatPrice}
          />
        </div>
      )}
    </div>
  );
}
