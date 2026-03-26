'use client';

import type { ORDER_STATUS } from '@cafe-idare/core';
import type { Database } from '@cafe-idare/database';
import { useTranslation } from '@cafe-idare/i18n';
import { Button, LoadingSpinner } from '@cafe-idare/ui';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  ChefHat,
  ChevronDown,
  Clock,
  FileText,
  Package,
  RefreshCw,
  Truck,
  User,
  UtensilsCrossed,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SplitPaymentModal } from '@/components/modals/split-payment-modal';
import { OrderDetailActions } from '@/components/orders/order-detail-actions';
import { OrderDetailDelivery } from '@/components/orders/order-detail-delivery';
import {
  calculateTax as calculateTaxFromSettings,
  useAssignDeliveryPerson,
  useCafeSettings,
  useOrder,
  useOrderPayments,
  useOrderTransferHistory,
  useStaff,
  useUpdateOrderItemStatus,
  useUpdateOrderStatus,
} from '@/hooks';
import { useFormatPrice } from '@/hooks/use-format-price';
import { supabase } from '@/lib/supabase/client';

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
  const { data: staffList } = useStaff();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [openItemMenu, setOpenItemMenu] = useState<string | null>(null);

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        () => {
          refetch();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          refetch();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_payments',
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          refetch();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, refetch]);

  // Calculate subtotal from items (before tax)
  const calculateSubtotal = () => {
    if (!order?.order_items) return 0;
    return order.order_items.reduce(
      (sum: number, item: OrderItem) => sum + item.quantity * item.item_price,
      0,
    );
  };

  // Get order total from the database (includes tax) for consistency
  // Fall back to calculating from items if total is not set
  const calculateOrderTotal = () => {
    if (order?.total) return order.total;
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

  // Format timestamp
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return 'bg-amber-100 text-amber-800 border border-amber-300';
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-yellow-100 text-yellow-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'served':
        return 'bg-purple-100 text-purple-800';
      case 'out_for_delivery':
        return 'bg-violet-100 text-violet-800';
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800';
      case 'paid':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get item status badge
  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-700',
          icon: <AlertCircle className="h-3 w-3" />,
          label: t('orders.pending'),
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
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', icon: null, label: status };
    }
  };

  const itemStatusOptions = [
    { value: 'pending', label: t('orders.pending'), icon: <AlertCircle className="h-3.5 w-3.5" /> },
    { value: 'preparing', label: t('orders.preparing'), icon: <ChefHat className="h-3.5 w-3.5" /> },
    { value: 'ready', label: t('orders.ready'), icon: <CheckCircle className="h-3.5 w-3.5" /> },
    {
      value: 'served',
      label: t('orders.served'),
      icon: <UtensilsCrossed className="h-3.5 w-3.5" />,
    },
  ];

  // Handle item status update — also syncs order-level status based on collective item states
  const handleItemStatusUpdate = async (itemId: string, newStatus: string) => {
    try {
      await updateItemStatus.mutateAsync({
        itemId,
        status: newStatus as 'pending' | 'preparing' | 'ready' | 'served',
      });
      setOpenItemMenu(null);

      // Sync order status based on updated item states
      if (order?.order_items) {
        const updatedItems = order.order_items.map((item: OrderItem) =>
          item.id === itemId ? { ...item, status: newStatus } : item,
        );
        type ItemWithStatus = { status: string };
        const nonCancelled = updatedItems.filter((i: ItemWithStatus) => i.status !== 'cancelled');

        if (nonCancelled.length > 0) {
          const allServed = nonCancelled.every((i: ItemWithStatus) => i.status === 'served');
          const allReadyOrServed = nonCancelled.every(
            (i: ItemWithStatus) => i.status === 'ready' || i.status === 'served',
          );
          const anyPreparing = nonCancelled.some((i: ItemWithStatus) => i.status === 'preparing');

          let targetStatus: keyof typeof ORDER_STATUS | null = null;
          if (allServed && order.status !== 'served') {
            targetStatus = 'SERVED';
          } else if (allReadyOrServed && !allServed && order.status !== 'ready') {
            targetStatus = 'READY';
          } else if (anyPreparing && order.status === 'new') {
            targetStatus = 'PREPARING';
          }

          if (targetStatus) {
            await updateOrderStatus.mutateAsync({
              orderId,
              status: targetStatus,
            });
          }
        }
      }

      toast.success(t('orders.itemStatusUpdated', { status: newStatus }));
    } catch (_error) {
      toast.error(t('orders.failedUpdateItemStatus'));
    }
  };

  // Handle status update
  const handleStatusUpdate = async (newStatus: keyof typeof ORDER_STATUS) => {
    try {
      await updateOrderStatus.mutateAsync({
        orderId,
        status: newStatus,
      });
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
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('back', { ns: 'common' })}</span>
          </Button>
          <h1 className="text-lg sm:text-2xl font-bold">
            {order.order_type === 'delivery'
              ? t('orders.delivery')
              : order.table
                ? order.table.table_number
                : t('orders.takeout')}
          </h1>
          <span
            className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(order.status)}`}
          >
            {order.status.toUpperCase()}
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
              <span className="text-gray-600 ml-2">({formatTime(transfer.created_at)})</span>
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

            return (
              <div key={item.id} className="px-3 sm:px-4 py-2 sm:py-3">
                <div className="flex justify-between items-start gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm sm:text-base">{item.quantity}x</span>
                      <span className="text-sm sm:text-base truncate">{item.menu_item?.name}</span>
                    </div>
                    {item.notes && (
                      <p className="text-xs sm:text-sm text-gray-600 mt-1 flex items-start gap-1">
                        <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        {item.notes}
                      </p>
                    )}
                  </div>

                  {/* Item Status Dropdown */}
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

                  <div className="text-right flex-shrink-0">
                    <p className="font-medium">{formatPrice(item.quantity * item.item_price)}</p>
                    <p className="text-sm text-gray-600">
                      {formatPrice(item.item_price)} {t('each', { ns: 'common' })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t px-4 py-3 space-y-2">
          {order && order.tax > 0 && (
            <>
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>{t('subtotal', { ns: 'common' })}</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>{t('orders.tax')}</span>
                <span>{formatPrice(order.tax)}</span>
              </div>
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
        onStatusUpdate={handleStatusUpdate}
        onOpenPayment={() => setIsPaymentModalOpen(true)}
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
    </div>
  );
}
