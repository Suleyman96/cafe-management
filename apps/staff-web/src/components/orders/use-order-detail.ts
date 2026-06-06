'use client';

import type { ORDER_STATUS } from '@gustri/core';
import { ORDER_STATUS_KEYS } from '@gustri/core';
import type { Database } from '@gustri/database/types';
import { useDateFormatter, useTranslation } from '@gustri/i18n';
import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { useState } from 'react';
import { toast } from 'sonner';
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

export type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  menu_item?: Database['public']['Tables']['menu_items']['Row'];
};

export type Payment = Database['public']['Tables']['order_payments']['Row'] & {
  received_by_staff?: Database['public']['Tables']['staff']['Row'];
  items_paid?: OrderItem[];
};

type Table = Database['public']['Tables']['tables']['Row'];

export type TableTransfer = Database['public']['Tables']['table_transfers']['Row'] & {
  from_table?: Pick<Table, 'table_number' | 'location'>;
  to_table?: Pick<Table, 'table_number' | 'location'>;
  transferred_by_staff?: Pick<Database['public']['Tables']['staff']['Row'], 'full_name'>;
};

export type OrderWithRelations = Database['public']['Tables']['orders']['Row'] & {
  table?: Table;
  order_items?: OrderItem[];
  assigned_waiter?: Database['public']['Tables']['staff']['Row'];
  order_payments?: Payment[];
  table_transfers?: TableTransfer[];
};

/**
 * Controller for the order-detail page: data fetching + realtime sync, the
 * derived money figures (subtotal/total/paid/remaining), modal + item-menu
 * state, and the status-update handlers. Extracted verbatim from
 * OrderDetailPage — behavior unchanged.
 */
export function useOrderDetail(orderId: string) {
  const { t } = useTranslation('staff');
  const dfDateTime = useDateFormatter({
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const { data: orderData, isLoading: loading, error, refetch } = useOrder(orderId);
  const { data: paymentsData } = useOrderPayments(orderId);
  const { data: transferHistory } = useOrderTransferHistory(orderId);
  const { data: cafeSettings } = useCafeSettings();
  const formatPrice = useFormatPrice();

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
    return dfDateTime.format(new Date(timestamp));
  };

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
      toast.success(t('orders.statusUpdatedTo', { status: t(ORDER_STATUS_KEYS[newStatus]) }));
    } catch (_error) {
      toast.error(t('orders.failedUpdateStatus'));
    }
  };

  const total = calculateOrderTotal();
  const paid = calculatePaidAmount();
  const remaining = total - paid;
  const isFullyPaid = remaining === 0 && total > 0;

  return {
    order,
    payments,
    transferHistory: transferHistory as TableTransfer[] | undefined,
    staffList,
    refundsData,
    loading,
    error,
    refetch,
    formatPrice,
    formatDate,
    // money
    subtotal: calculateSubtotal(),
    total,
    paid,
    remaining,
    isFullyPaid,
    // permissions / connectivity
    canDiscount,
    canRefund,
    canMutate,
    assignDeliveryPerson,
    // item menu + modals
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
    // handlers
    handleItemStatusUpdate,
    handleStatusUpdate,
  };
}
