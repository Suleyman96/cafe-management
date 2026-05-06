'use client';

import { formatTime, type ORDER_STATUS, ORDER_STATUS_KEYS } from '@gustri/core';
import type { Database, OrderItemStatus } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { Button, getOrderStatusColor, LoadingSpinner, ORDER_ITEM_STATUS_BADGES } from '@gustri/ui';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  Clock,
  FileText,
  Home,
  Package,
  RefreshCw,
  Truck,
  User,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmCloseUnpaidModal } from '@/components/modals/confirm-close-unpaid-modal';
import { DiscountModal } from '@/components/modals/discount-modal';
import { RefundModal } from '@/components/modals/refund-modal';
import { SplitPaymentModal } from '@/components/modals/split-payment-modal';
import { OrderDetailActions } from '@/components/orders/order-detail-actions';
import { OrderDetailDelivery } from '@/components/orders/order-detail-delivery';
import {
  calculateTax as calculateTaxFromSettings,
  useAssignDeliveryPerson,
  useCafeSettings,
  useMarkDelivered,
  useMarkOutForDelivery,
  useOrder,
  useOrderPayments,
  useOrderRefunds,
  useOrderTransferHistory,
  useStaff,
  useUpdateOrderItemStatus,
  useUpdateOrderStatus,
} from '@/hooks';
import { useCanPerform } from '@/hooks/use-can-perform';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useIsOnline } from '@/hooks/use-is-online';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { ORDER_ITEM_STATUS_ICONS } from '@/lib/enum-icons';

type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  menu_item?: Database['public']['Tables']['menu_items']['Row'];
};

type Payment = Database['public']['Tables']['order_payments']['Row'] & {
  received_by_staff?: Database['public']['Tables']['staff']['Row'];
  items_paid?: OrderItem[];
};

type Table = Database['public']['Tables']['tables']['Row'];

type TableTransfer = Database['public']['Tables']['table_transfers']['Row'] & {
  from_table?: Pick<Table, 'table_number' | 'location'>;
  to_table?: Pick<Table, 'table_number' | 'location'>;
  transferred_by_staff?: Pick<Database['public']['Tables']['staff']['Row'], 'full_name'>;
};

// Complex order type with all joined relations
type OrderWithRelations = Database['public']['Tables']['orders']['Row'] & {
  table?: Table;
  order_items?: OrderItem[];
  assigned_waiter?: Database['public']['Tables']['staff']['Row'];
  order_payments?: Payment[];
  table_transfers?: TableTransfer[];
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const { t } = useTranslation('staff');

  const { data: orderData, isLoading: loading, error, refetch } = useOrder(orderId);
  const { data: paymentsData } = useOrderPayments(orderId);
  const { data: transferHistory } = useOrderTransferHistory(orderId);
  const { data: cafeSettings } = useCafeSettings();
  const formatPrice = useFormatPrice();

  // Type assertions for the complex joined data
  const order = orderData as OrderWithRelations | undefined;
  const payments = paymentsData as Payment[] | undefined;
  const updateOrderStatus = useUpdateOrderStatus();
  const updateItemStatus = useUpdateOrderItemStatus();
  const assignDeliveryPerson = useAssignDeliveryPerson();
  const markOutForDelivery = useMarkOutForDelivery();
  const markDelivered = useMarkDelivered();
  const { data: staffList } = useStaff();
  const { data: refundsData } = useOrderRefunds(orderId);
  const canDiscount = useCanPerform('apply_discount');
  const canRefund = useCanPerform('issue_refund');
  const canMutate = useIsOnline();
  const tenantId = useTenantId();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isCloseUnpaidModalOpen, setIsCloseUnpaidModalOpen] = useState(false);
  const [openItemMenu, setOpenItemMenu] = useState<string | null>(null);

  // Real-time subscription via shared hook
  useRealtimeSync(`order-detail-${orderId}`, [
    {
      table: 'orders',
      filter: `id=eq.${orderId}`,
      queryKeys: [tenantKey(tenantId, QUERY_KEYS.ORDER, orderId)],
    },
    {
      table: 'order_items',
      filter: `order_id=eq.${orderId}`,
      queryKeys: [tenantKey(tenantId, QUERY_KEYS.ORDER, orderId)],
    },
    {
      table: 'order_payments',
      filter: `order_id=eq.${orderId}`,
      queryKeys: [
        tenantKey(tenantId, QUERY_KEYS.ORDER, orderId),
        tenantKey(tenantId, QUERY_KEYS.PAYMENTS, orderId),
      ],
    },
  ]);

  // Calculate subtotal from non-cancelled items (before tax)
  const calculateSubtotal = () => {
    if (!order?.order_items) return 0;
    return order.order_items
      .filter((item: OrderItem) => item.status !== 'cancelled')
      .reduce((sum: number, item: OrderItem) => sum + item.quantity * item.item_price, 0);
  };

  // Get order total from the database (includes tax) for consistency
  // Fall back to calculating from items if total is not set
  const calculateOrderTotal = () => {
    if (order?.total != null) return order.total;
    const subtotal = calculateSubtotal();
    // Use cafe settings for tax calculation
    if (cafeSettings?.tax_enabled) {
      return subtotal + calculateTaxFromSettings(subtotal, cafeSettings);
    }
    return subtotal;
  };

  const calculatePaidAmount = () => {
    if (!payments) return 0;
    return payments.reduce((sum: number, payment: Payment) => sum + payment.amount, 0);
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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

  const itemStatusOptions: Array<{
    value: OrderItemStatus;
    label: string;
    icon: ReactNode;
  }> = (['pending', 'preparing', 'ready', 'served'] as const).map((value) => {
    const Icon = ORDER_ITEM_STATUS_ICONS[value];
    return {
      value,
      label: t(ORDER_ITEM_STATUS_BADGES[value].labelKey),
      icon: <Icon className="h-3.5 w-3.5" />,
    };
  });

  const handleItemStatusUpdate = async (itemId: string, newStatus: string) => {
    try {
      await updateItemStatus.mutateAsync({
        itemId,
        status: newStatus as 'pending' | 'preparing' | 'ready' | 'served',
      });
      setOpenItemMenu(null);
      // Order status is now synced by database trigger (trg_sync_order_status_from_items).
      toast.success(t('orders.itemStatusUpdated', { status: newStatus }));
    } catch (_error) {
      toast.error(t('orders.failedUpdateItemStatus'));
    }
  };

  // Handle status update — uses delivery-specific hooks for delivery orders
  const handleStatusUpdate = async (newStatus: keyof typeof ORDER_STATUS) => {
    try {
      if (order?.order_type === 'delivery' && newStatus === 'OUT_FOR_DELIVERY') {
        if (!order.delivery_person_id) {
          toast.error(t('delivery.assignDriverFirst'));
          return;
        }
        await markOutForDelivery.mutateAsync({
          orderId,
          deliveryPersonId: order.delivery_person_id,
        });
      } else if (order?.order_type === 'delivery' && newStatus === 'DELIVERED') {
        await markDelivered.mutateAsync(orderId);
      } else {
        await updateOrderStatus.mutateAsync({
          orderId,
          status: newStatus,
        });
      }
      toast.success(`${t('orders.statusUpdated')} ${String(newStatus).toLowerCase()}`);
    } catch (_error) {
      toast.error(t('orders.failedUpdateStatus'));
    }
  };

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

  const total = calculateOrderTotal();
  const paid = calculatePaidAmount();
  const remaining = total - paid;
  const isFullyPaid = remaining === 0 && total > 0;

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
                <span className="text-gray-600 ml-2">({formatTime(transfer.created_at)})</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Order Items */}
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
                              onClick={() => handleItemStatusUpdate(item.id, option.value)}
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
            (order.tax > 0 ||
              (order.discount_amount ?? 0) > 0 ||
              (order.delivery_fee ?? 0) > 0) && (
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

      {/* Payment History */}
      {payments && payments.length > 0 && (
        <div className="border rounded-lg mb-6">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">{t('orders.paymentHistory')}</h2>
          </div>
          <div className="divide-y">
            {payments.map((payment: Payment, index: number) => {
              const paymentTypeLabel =
                payment.payment_type === 'full'
                  ? t('payment.fullPayment')
                  : payment.payment_type === 'specific_items'
                    ? t('payment.specificItems')
                    : t('payment.partialAmount');

              return (
                <div key={payment.id} className="px-4 py-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{formatPrice(payment.amount)}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {paymentTypeLabel}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 capitalize">
                          {payment.payment_method}
                        </span>
                      </div>
                      {Number(payment.tip_amount) > 0 && (
                        <p className="text-sm text-green-600 mt-0.5">
                          + {formatPrice(payment.tip_amount)} {t('orders.tip')}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {payment.received_by_staff?.full_name || 'Unknown'} &middot;{' '}
                        {formatTime(payment.created_at)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs text-gray-400">#{index + 1}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t px-4 py-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold">{t('orders.totalPaid')}</span>
              <span className="font-semibold text-green-600">{formatPrice(paid)}</span>
            </div>
            {remaining > 0 && (
              <div className="flex justify-between items-center mt-2">
                <span className="font-semibold">{t('orders.remaining')}</span>
                <span className="font-semibold text-orange-600">{formatPrice(remaining)}</span>
              </div>
            )}
          </div>
        </div>
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
        orderSubtotal={calculateSubtotal()}
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
