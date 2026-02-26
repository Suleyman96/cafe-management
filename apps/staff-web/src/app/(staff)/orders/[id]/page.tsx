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
  CreditCard,
  FileText,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Smartphone,
  ThumbsUp,
  Truck,
  User,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SplitPaymentModal } from '@/components/modals/split-payment-modal';
import {
  calculateTax as calculateTaxFromSettings,
  formatPriceWithSettings,
  useAssignDeliveryPerson,
  useCafeSettings,
  useOrder,
  useOrderPayments,
  useOrderTransferHistory,
  useStaff,
  useUpdateOrderItemStatus,
  useUpdateOrderStatus,
} from '@/hooks';
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
  from_table?: Table;
  to_table?: Table;
  transferred_by_staff?: Database['public']['Tables']['staff']['Row'];
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

  // Type assertions for the complex joined data
  const order = orderData as OrderWithRelations | undefined;
  const payments = paymentsData as Payment[] | undefined;
  const updateOrderStatus = useUpdateOrderStatus();
  const updateItemStatus = useUpdateOrderItemStatus();
  const assignDeliveryPerson = useAssignDeliveryPerson();
  const { data: staffList } = useStaff();

  // Format price using cafe settings or fallback
  const formatPrice = (amount: number) => {
    if (cafeSettings) {
      return formatPriceWithSettings(amount, cafeSettings);
    }
    return `$${amount.toFixed(2)}`;
  };

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

  // Calculate tax amount based on cafe settings
  const calculateTax = () => {
    if (!cafeSettings?.tax_enabled) return 0;
    const subtotal = calculateSubtotal();
    return calculateTaxFromSettings(subtotal, cafeSettings);
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

  // Handle item status update
  const handleItemStatusUpdate = async (itemId: string, newStatus: string) => {
    try {
      await updateItemStatus.mutateAsync({
        itemId,
        status: newStatus as 'pending' | 'preparing' | 'ready' | 'served',
      });
      setOpenItemMenu(null);
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
        <div className="bg-purple-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 border border-purple-200">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-purple-800">
            <Truck className="h-4 w-4" />
            {t('orders.deliveryInformation')}
          </h3>
          <div className="space-y-2 text-sm">
            {order.delivery_address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                <span>{order.delivery_address}</span>
              </div>
            )}
            {order.customer_name && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-purple-500 flex-shrink-0" />
                <span>{order.customer_name}</span>
              </div>
            )}
            {order.customer_phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-purple-500 flex-shrink-0" />
                <a href={`tel:${order.customer_phone}`} className="text-blue-600 underline">
                  {order.customer_phone}
                </a>
              </div>
            )}
            {order.delivery_notes && (
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600">{order.delivery_notes}</span>
              </div>
            )}
            {order.delivery_fee > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t border-purple-200">
                <CreditCard className="h-4 w-4 text-purple-500 flex-shrink-0" />
                <span>
                  {t('deliveryFee', { ns: 'common' })}:{' '}
                  <strong>{formatPrice(order.delivery_fee)}</strong>
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 pt-2 border-t border-purple-200">
              <Truck className="h-4 w-4 text-purple-500 flex-shrink-0" />
              <span className="text-sm">{t('delivery.driver')}</span>
              {['delivered', 'cancelled'].includes(order.status) ? (
                <span className="font-medium">
                  {(order as any).delivery_person?.full_name || t('orders.notAssigned')}
                </span>
              ) : (
                <select
                  className="flex-1 px-2 py-1 border border-purple-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={order.delivery_person_id || ''}
                  onChange={async (e) => {
                    const staffId = e.target.value;
                    if (!staffId) return;
                    try {
                      await assignDeliveryPerson.mutateAsync({
                        orderId: order.id,
                        staffId,
                      });
                      toast.success(t('orders.deliveryPersonAssigned'));
                      refetch();
                    } catch {
                      toast.error(t('orders.failedAssignDriver'));
                    }
                  }}
                >
                  <option value="">{t('orders.selectDriver')}</option>
                  {staffList?.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
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
          {cafeSettings?.tax_enabled && (
            <>
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>{t('subtotal', { ns: 'common' })}</span>
                <span>{formatPrice(calculateSubtotal())}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>
                  {t('orders.tax')} ({cafeSettings.tax_percentage}%)
                </span>
                <span>{formatPrice(calculateTax())}</span>
              </div>
            </>
          )}
          <div
            className={`flex justify-between items-center text-lg font-semibold ${cafeSettings?.tax_enabled ? 'pt-2 border-t' : ''}`}
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
            {payments.map((payment: Payment) => (
              <div key={payment.id} className="px-4 py-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{formatPrice(payment.amount)}</p>
                    {(payment as { tip_amount?: number }).tip_amount &&
                      (payment as { tip_amount?: number }).tip_amount! > 0 && (
                        <p className="text-sm text-green-600">
                          + {formatPrice((payment as { tip_amount?: number }).tip_amount!)}{' '}
                          {t('orders.tip')}
                        </p>
                      )}
                    <p className="text-sm text-gray-600 capitalize">{payment.payment_method}</p>
                    <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                      <CreditCard className="h-3 w-3 text-green-500" />
                      {t('orders.receivedBy')} {payment.received_by_staff?.full_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{formatTime(payment.created_at)}</p>
                  </div>
                  {payment.items_paid && payment.items_paid.length > 0 && (
                    <div className="text-sm text-gray-600">
                      {payment.items_paid.length} {t('items', { ns: 'common' })}
                    </div>
                  )}
                </div>
              </div>
            ))}
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
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {/* Pending Approval: Show approve button */}
        {order.status === 'pending_approval' && (
          <>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 flex items-center gap-1 sm:gap-2"
              onClick={() => handleStatusUpdate('NEW')}
            >
              <ThumbsUp className="h-4 w-4" />
              {t('approve', { ns: 'common' })}
            </Button>
            {(order as any).source === 'customer' && (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                <Smartphone className="h-3 w-3" />
                {t('orders.qrOrder')}
              </span>
            )}
          </>
        )}
        {order.status === 'new' && (
          <Button
            size="sm"
            onClick={() => handleStatusUpdate('PREPARING')}
            className="flex items-center gap-1 sm:gap-2"
          >
            <ChefHat className="h-4 w-4" />
            {t('orders.startPreparing')}
          </Button>
        )}
        {order.status === 'preparing' && (
          <Button
            size="sm"
            onClick={() => handleStatusUpdate('READY')}
            className="flex items-center gap-1 sm:gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            {t('orders.ready')}
          </Button>
        )}
        {order.status === 'ready' && order.table && order.order_type !== 'delivery' && (
          <Button
            size="sm"
            onClick={() => handleStatusUpdate('SERVED')}
            className="flex items-center gap-1 sm:gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            {t('orders.served')}
          </Button>
        )}
        {/* Delivery: Out for Delivery when ready */}
        {order.status === 'ready' && order.order_type === 'delivery' && (
          <Button
            size="sm"
            onClick={() => handleStatusUpdate('OUT_FOR_DELIVERY')}
            className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1 sm:gap-2"
          >
            <Truck className="h-4 w-4" />
            {t('orders.outForDelivery')}
          </Button>
        )}
        {/* Delivery: Mark Delivered */}
        {order.status === 'out_for_delivery' && order.order_type === 'delivery' && (
          <Button
            size="sm"
            onClick={() => handleStatusUpdate('DELIVERED')}
            className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 sm:gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            {t('orders.markDelivered')}
          </Button>
        )}
        {(order.status === 'served' || order.status === 'ready') &&
          !isFullyPaid &&
          order.order_type !== 'delivery' && (
            <Button
              size="sm"
              onClick={() => setIsPaymentModalOpen(true)}
              className="flex items-center gap-1 sm:gap-2"
            >
              <CreditCard className="h-4 w-4" />
              {t('orders.payment')}
            </Button>
          )}
        {isFullyPaid && order.status !== 'closed' && order.status !== 'cancelled' && (
          <Button
            size="sm"
            onClick={() => handleStatusUpdate('CLOSED')}
            className="flex items-center gap-1 sm:gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            {t('close', { ns: 'common' })}
          </Button>
        )}
        {['pending_approval', 'new', 'preparing', 'ready', 'served', 'out_for_delivery'].includes(
          order.status,
        ) && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleStatusUpdate('CANCELLED')}
            className="flex items-center gap-1 sm:gap-2"
          >
            <XCircle className="h-4 w-4" />
            {order.status === 'pending_approval'
              ? t('reject', { ns: 'common' })
              : t('cancel', { ns: 'common' })}
          </Button>
        )}
      </div>

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
