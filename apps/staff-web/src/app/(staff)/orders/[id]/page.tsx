'use client';

import { formatTime, ORDER_STATUS_KEYS } from '@gustri/core';
import { useLocale, useTranslation } from '@gustri/i18n';
import { Button, getOrderStatusColor, LoadingSpinner } from '@gustri/ui-web';
import { ArrowLeft, ArrowRight, Clock, Home, Package, RefreshCw, Truck, User } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ConfirmCloseUnpaidModal } from '@/components/modals/confirm-close-unpaid-modal';
import { DiscountModal } from '@/components/modals/discount-modal';
import { RefundModal } from '@/components/modals/refund-modal';
import { SplitPaymentModal } from '@/components/modals/split-payment-modal';
import { OrderDetailActions } from '@/components/orders/order-detail-actions';
import { OrderDetailDelivery } from '@/components/orders/order-detail-delivery';
import { OrderDetailItems } from '@/components/orders/order-detail-items';
import { OrderDetailPayments } from '@/components/orders/order-detail-payments';
import {
  type OrderItem,
  type TableTransfer,
  useOrderDetail,
} from '@/components/orders/use-order-detail';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const { t } = useTranslation('staff');
  const locale = useLocale();

  const {
    order,
    payments,
    transferHistory,
    staffList,
    refundsData,
    loading,
    error,
    refetch,
    formatPrice,
    formatDate,
    subtotal,
    total,
    paid,
    remaining,
    isFullyPaid,
    canDiscount,
    canRefund,
    canMutate,
    assignDeliveryPerson,
    openItemMenu,
    setOpenItemMenu,
    isPaymentModalOpen,
    setIsPaymentModalOpen,
    isDiscountModalOpen,
    setIsDiscountModalOpen,
    isRefundModalOpen,
    setIsRefundModalOpen,
    isCloseUnpaidModalOpen,
    setIsCloseUnpaidModalOpen,
    handleItemStatusUpdate,
    handleStatusUpdate,
  } = useOrderDetail(orderId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">{t('orders.errorLoading')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              order.status === 'closed' || order.status === 'cancelled'
                ? router.push('/')
                : router.back()
            }
          >
            {order.status === 'closed' || order.status === 'cancelled' ? (
              <Home className="h-4 w-4" />
            ) : (
              <>
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('back', { ns: 'common' })}</span>
              </>
            )}
          </Button>
          <h1 className="text-lg sm:text-2xl font-bold">
            {order.order_type === 'delivery'
              ? t('orders.delivery')
              : order.table
                ? order.table.table_number
                : t('orders.takeout')}
          </h1>
          <span
            className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getOrderStatusColor(order.status)}`}
          >
            {t(ORDER_STATUS_KEYS[order.status] || order.status)}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Order Info */}
      <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <p className="text-sm text-gray-600">{t('orders.orderId')}</p>
            <p className="font-mono text-sm">#{order.id.slice(0, 8)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">{t('created', { ns: 'common' })}</p>
            <p className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(order.created_at)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">{t('orders.orderType')}</p>
            <p className="flex items-center gap-1">
              {order.order_type === 'delivery' ? (
                <Truck className="h-4 w-4 text-purple-600" />
              ) : order.order_type === 'takeout' ? (
                <Package className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
              {order.order_type === 'delivery'
                ? t('orders.delivery')
                : order.order_type === 'takeout'
                  ? t('orders.takeout')
                  : t('orders.dineIn')}
            </p>
          </div>
          {order.customer_name && (
            <div>
              <p className="text-sm text-gray-600">{t('orders.customer')}</p>
              <p>{order.customer_name}</p>
            </div>
          )}
          {order.customer_phone && (
            <div>
              <p className="text-sm text-gray-600">{t('phone', { ns: 'common' })}</p>
              <p>{order.customer_phone}</p>
            </div>
          )}
          {order.assigned_waiter && (
            <div>
              <p className="text-sm text-gray-600">{t('orders.orderTakenBy')}</p>
              <p className="flex items-center gap-1">
                <User className="h-3 w-3 text-blue-500" />
                {order.assigned_waiter.full_name}
              </p>
            </div>
          )}
        </div>
        {/* Customer Notes */}
        {order.customer_notes && (
          <div className="mt-4 p-3 bg-amber-100 rounded-lg border border-amber-300">
            <p className="text-sm text-amber-800">
              <span className="font-medium">{t('orders.customerNote')}</span> {order.customer_notes}
            </p>
          </div>
        )}
      </div>

      {/* Delivery Info Section */}
      {order.order_type === 'delivery' && (
        <OrderDetailDelivery
          order={order}
          staffList={staffList}
          onAssignDriver={assignDeliveryPerson.mutateAsync}
          onRefetch={refetch}
          formatPrice={formatPrice}
        />
      )}

      {/* Table Transfer History */}
      {transferHistory && transferHistory.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            {t('orders.tableTransferHistory')}
          </h3>
          {transferHistory.map((transfer: TableTransfer) => (
            <div key={transfer.id} className="text-sm">
              {t('orders.transferredFromTo', {
                from: transfer.from_table?.table_number,
                to: transfer.to_table?.table_number,
              })}
              {transfer.reason && ` - ${transfer.reason}`}
              {transfer.created_at && (
                <span className="text-gray-600 ml-2">
                  ({formatTime(transfer.created_at, locale)})
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Order Items */}
      <OrderDetailItems
        order={order}
        total={total}
        openItemMenu={openItemMenu}
        setOpenItemMenu={setOpenItemMenu}
        onItemStatusUpdate={handleItemStatusUpdate}
        formatPrice={formatPrice}
      />

      {/* Payment History */}
      {payments && payments.length > 0 && (
        <OrderDetailPayments
          payments={payments}
          paid={paid}
          remaining={remaining}
          formatPrice={formatPrice}
        />
      )}

      {/* Action Buttons */}
      <OrderDetailActions
        order={order}
        isFullyPaid={isFullyPaid}
        hasItems={
          (order.order_items?.filter((i: OrderItem) => i.status !== 'cancelled').length ?? 0) > 0
        }
        canMutate={canMutate}
        onStatusUpdate={handleStatusUpdate}
        onOpenPayment={() => setIsPaymentModalOpen(true)}
        onOpenDiscount={() => setIsDiscountModalOpen(true)}
        canDiscount={canDiscount}
        onOpenRefund={() => setIsRefundModalOpen(true)}
        canRefund={canRefund && (payments?.length ?? 0) > 0}
        onOpenCloseUnpaid={() => setIsCloseUnpaidModalOpen(true)}
      />

      <SplitPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        order={order}
        onSuccess={() => {
          setIsPaymentModalOpen(false);
          toast.success(t('orders.paymentProcessed'));
          refetch();
        }}
      />

      <DiscountModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        orderId={order.id}
        orderSubtotal={subtotal}
        currentDiscountType={order.discount_type || 'none'}
        currentDiscountValue={order.discount_value ?? 0}
        onSuccess={() => refetch()}
        orderLabel={`#${order.id.slice(0, 8)}`}
        orderContextLabel={
          order.order_type === 'delivery'
            ? t('orders.delivery')
            : order.table
              ? order.table.table_number
              : t('orders.takeout')
        }
        customerName={order.customer_name ?? null}
      />

      <RefundModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        orderId={order.id}
        totalPaid={paid}
        totalRefunded={
          (refundsData as Array<{ amount: number }>)?.reduce((sum, r) => sum + r.amount, 0) || 0
        }
        onSuccess={() => refetch()}
        orderLabel={`#${order.id.slice(0, 8)}`}
        orderContextLabel={
          order.order_type === 'delivery'
            ? t('orders.delivery')
            : order.table
              ? order.table.table_number
              : t('orders.takeout')
        }
        customerName={order.customer_name ?? null}
      />

      <ConfirmCloseUnpaidModal
        isOpen={isCloseUnpaidModalOpen}
        orderId={order.id}
        orderLabel={
          order.order_type === 'delivery'
            ? `${t('orders.delivery')} · #${order.id.slice(0, 8)}`
            : order.table
              ? `${order.table.table_number} · #${order.id.slice(0, 8)}`
              : `${t('orders.takeout')} · #${order.id.slice(0, 8)}`
        }
        remainingAmount={remaining}
        onClose={() => setIsCloseUnpaidModalOpen(false)}
        onSuccess={() => {
          setIsCloseUnpaidModalOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
