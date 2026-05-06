'use client';

import type { ORDER_STATUS } from '@gustri/core';
import type { Database } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import * as Sentry from '@sentry/nextjs';
import { CheckCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  useCafeSettings,
  useCreatePayment,
  useOrderPayments,
  useOrderRemainingBalance,
  useUpdateOrderStatus,
} from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useIsOnline } from '@/hooks/use-is-online';
import { usePersistentClientRequestId } from '@/hooks/use-persistent-client-request-id';
import { ItemPaymentForm } from './payment/item-payment-form';
import { OrderSummary } from './payment/order-summary';
import { PartialPaymentForm } from './payment/partial-payment-form';
import { PaymentFooter } from './payment/payment-footer';
import { PaymentMethodSelector } from './payment/payment-method-selector';
import { PaymentModeSelector } from './payment/payment-mode-selector';
import { TipInput } from './payment/tip-input';

type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  menu_item?: Database['public']['Tables']['menu_items']['Row'];
};

type Order = Database['public']['Tables']['orders']['Row'] & {
  order_items?: OrderItem[];
};

interface SplitPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | undefined;
  onSuccess: () => void;
}

type PaymentMode = 'full' | 'partial' | 'items';

export function SplitPaymentModal({ isOpen, onClose, order, onSuccess }: SplitPaymentModalProps) {
  const { t } = useTranslation('staff');
  const { staff } = useAuth();
  const createPayment = useCreatePayment();
  const updateOrderStatus = useUpdateOrderStatus();
  const { data: remainingBalance } = useOrderRemainingBalance(order?.id || '');
  const { data: existingPayments } = useOrderPayments(order?.id || '');
  const formatPrice = useFormatPrice();
  const { data: cafeSettings } = useCafeSettings();
  const isOnline = useIsOnline();
  // Keyed by order so a payment retry after error → modal close → reopen
  // for the SAME order reuses the same client_request_id and hits
  // server-side dedupe on `(tenant_id, client_request_id)`. Reset only
  // after a confirmed success (or the user starts an unrelated order).
  const idempotencyKey = usePersistentClientRequestId(`payment:${order?.id ?? '_pending'}`);

  const [paymentMode, setPaymentMode] = useState<PaymentMode>('full');
  const [partialAmount, setPartialAmount] = useState<string>('');
  // Map of itemId → selected quantity (0 means not selected)
  const [selectedItemQuantities, setSelectedItemQuantities] = useState<Map<string, number>>(
    new Map(),
  );
  const [tipAmount, setTipAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'digital'>('cash');

  // `loading` derives from in-flight mutations rather than a separate state
  // flag — `retry: 0` flips `isPending` back to false on error so the user
  // can retry; the retry reuses `idempotencyKey.get()` so the server
  // dedupes via `(tenant_id, client_request_id)` on `order_payments`.
  const loading = createPayment.isPending || updateOrderStatus.isPending;

  // Reset selection state when modal opens to clear stale data from previous sessions.
  // The idempotency key is intentionally NOT reset here — same `(orderId)` reopen
  // after an error must replay the same `client_request_id` so the server dedupes.
  // It resets only on confirmed success (see handlePayment) or when the order itself
  // changes (the persistent hook is keyed by orderId, so a different order gets a
  // fresh id automatically).
  useEffect(() => {
    if (isOpen) {
      setPaymentMode('full');
      setPartialAmount('');
      setSelectedItemQuantities(new Map());
      setTipAmount('');
      setPaymentMethod('cash');
    }
  }, [isOpen]);

  // Collect item IDs that have already been fully paid via specific_items payments
  const paidItemIds = new Set<string>();
  if (existingPayments) {
    for (const payment of existingPayments) {
      if (payment.payment_type === 'specific_items' && payment.order_item_ids) {
        for (const id of payment.order_item_ids) {
          paidItemIds.add(id);
        }
      }
    }
  }

  // Filter out cancelled items for payment
  const payableItems =
    order?.order_items?.filter((item: OrderItem) => item.status !== 'cancelled') || [];

  // Items available for selection in "Specific Items" mode (exclude already-paid items)
  const unpaidItems = payableItems.filter((item: OrderItem) => !paidItemIds.has(item.id));

  // Use stored order data for consistency — the order's subtotal/tax/total were calculated
  // at creation time and should be used as-is, regardless of current tax settings
  const itemsSubtotalCalc = payableItems.reduce(
    (sum: number, item: OrderItem) => sum + item.quantity * item.item_price,
    0,
  );
  const orderSubtotal = order?.subtotal ?? itemsSubtotalCalc;
  const orderTax = order?.tax ?? 0;
  const orderTotal = order?.total ?? orderSubtotal + orderTax;

  // Calculate subtotal of selected items (before tax)
  const calculateSelectedItemsSubtotal = () => {
    let total = 0;
    for (const [itemId, qty] of selectedItemQuantities) {
      if (qty <= 0) continue;
      const item = unpaidItems.find((i: OrderItem) => i.id === itemId);
      if (item) {
        total += qty * item.item_price;
      }
    }
    return total;
  };

  // Calculate proportional tax for selected items based on stored order tax
  const calculateSelectedItemsTax = () => {
    if (orderTax <= 0 || orderSubtotal <= 0) return 0;
    const itemsSubtotal = calculateSelectedItemsSubtotal();
    // Proportional share of the stored order tax
    return Math.round((itemsSubtotal / orderSubtotal) * orderTax * 100) / 100;
  };

  // Total for selected items including proportional tax
  const calculateSelectedItemsTotal = () => {
    return calculateSelectedItemsSubtotal() + calculateSelectedItemsTax();
  };

  // Check if all selected items are at full quantity (for specific_items payment type)
  const allSelectedAtFullQuantity = () => {
    for (const [itemId, qty] of selectedItemQuantities) {
      if (qty <= 0) continue;
      const item = unpaidItems.find((i: OrderItem) => i.id === itemId);
      if (item && qty < item.quantity) return false;
    }
    return true;
  };

  const getPaymentAmount = () => {
    switch (paymentMode) {
      case 'full':
        return remainingBalance !== undefined ? remainingBalance : orderTotal;
      case 'partial':
        return parseFloat(partialAmount) || 0;
      case 'items':
        return calculateSelectedItemsTotal();
    }
  };

  const handlePayment = async () => {
    let amount = getPaymentAmount();
    if (amount <= 0 || !staff?.id || !order?.id) return;

    const balance = remainingBalance ?? orderTotal;

    // Reject if payment exceeds remaining balance (allow tiny rounding tolerance of 0.01)
    if (amount > balance + 0.01) {
      toast.error(
        t('payment.exceedsBalance', {
          amount: formatPrice(amount),
          balance: formatPrice(balance),
        }),
      );
      return;
    }

    // Cap at remaining balance to handle rounding edge cases
    if (amount > balance) {
      amount = balance;
    }

    // Determine payment type for items mode
    let paymentType: 'full' | 'partial_amount' | 'specific_items';
    let orderItemIds: string[] | null = null;

    if (paymentMode === 'full') {
      paymentType = 'full';
    } else if (paymentMode === 'partial') {
      paymentType = 'partial_amount';
    } else {
      // Items mode
      const balance = remainingBalance ?? orderTotal;
      const hasTax = orderTax > 0;

      // Use specific_items only when no tax (DB trigger validates amount == items subtotal without tax)
      // and all selected items are at full quantity
      if (!hasTax && allSelectedAtFullQuantity() && amount <= balance) {
        paymentType = 'specific_items';
        const unpaidItemIds = new Set(unpaidItems.map((i: OrderItem) => i.id));
        orderItemIds = Array.from(selectedItemQuantities.entries())
          .filter(([id, qty]) => qty > 0 && unpaidItemIds.has(id))
          .map(([id]) => id);
      } else {
        // Use partial_amount — amount includes proportional tax, capped at remaining balance
        paymentType = 'partial_amount';
        amount = Math.min(amount, balance);
      }
    }

    try {
      await createPayment.mutateAsync({
        order_id: order?.id || '',
        received_by: staff.id,
        payment_type: paymentType,
        amount,
        tip_amount: parseFloat(tipAmount) || 0,
        payment_method: paymentMethod,
        order_item_ids: orderItemIds,
        notes: null,
        client_request_id: idempotencyKey.get(),
      });
      idempotencyKey.reset();
      onSuccess();
    } catch (error: unknown) {
      Sentry.captureException(error);
      const message = error instanceof Error ? error.message : t('payment.paymentFailed');
      toast.error(message);
    }
  };

  const updateItemQuantity = (itemId: string, maxQty: number, delta: number) => {
    setSelectedItemQuantities((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(itemId) || 0;
      const next = Math.max(0, Math.min(maxQty, current + delta));
      if (next === 0) {
        newMap.delete(itemId);
      } else {
        newMap.set(itemId, next);
      }
      return newMap;
    });
  };

  // Complete order (mark as paid) - used when order is fully paid or has $0 total
  const handleCompleteOrder = async () => {
    if (!order?.id) return;

    try {
      await updateOrderStatus.mutateAsync({
        orderId: order.id,
        status: 'CLOSED' as keyof typeof ORDER_STATUS,
      });
      onSuccess();
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('payment.completeFailed'));
    }
  };

  if (!isOpen || !order) return null;

  const isFullyPaid = remainingBalance !== undefined && remainingBalance <= 0;
  const isZeroTotal = orderTotal === 0;
  const hasSelectedItems = Array.from(selectedItemQuantities.values()).some((q) => q > 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">{t('payment.processPaymentCash')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {(isFullyPaid || isZeroTotal) && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">
                  {isZeroTotal ? t('payment.noItemsToPay') : t('payment.orderFullyPaid')}
                </span>
              </div>
              <p className="text-sm text-green-600 mt-2">{t('payment.clickComplete')}</p>
            </div>
          )}

          <OrderSummary
            order={order}
            orderSubtotal={orderSubtotal}
            orderTax={orderTax}
            orderTotal={orderTotal}
            remainingBalance={remainingBalance}
            isFullyPaid={isFullyPaid}
            formatPrice={formatPrice}
            t={t}
          />

          <PaymentModeSelector
            paymentMode={paymentMode}
            onModeChange={setPaymentMode}
            remainingBalance={remainingBalance}
            orderTotal={orderTotal}
            formatPrice={formatPrice}
            t={t}
          />

          {paymentMode === 'partial' && (
            <PartialPaymentForm
              partialAmount={partialAmount}
              onAmountChange={setPartialAmount}
              remainingBalance={remainingBalance}
              orderTotal={orderTotal}
              currencySymbol={cafeSettings?.currency_symbol || '$'}
              formatPrice={formatPrice}
              t={t}
            />
          )}

          {paymentMode === 'items' && (
            <ItemPaymentForm
              unpaidItems={unpaidItems}
              selectedItemQuantities={selectedItemQuantities}
              onUpdateQuantity={updateItemQuantity}
              selectedItemsTotal={calculateSelectedItemsTotal()}
              hasSelectedItems={hasSelectedItems}
              formatPrice={formatPrice}
              t={t}
            />
          )}

          {!isFullyPaid && !isZeroTotal && (
            <PaymentMethodSelector
              paymentMethod={paymentMethod}
              onMethodChange={setPaymentMethod}
              t={t}
            />
          )}

          {cafeSettings?.tips_enabled && !isFullyPaid && !isZeroTotal && (
            <TipInput
              tipAmount={tipAmount}
              onTipChange={setTipAmount}
              currencySymbol={cafeSettings.currency_symbol}
              formatPrice={formatPrice}
              t={t}
            />
          )}
        </div>

        <PaymentFooter
          paymentAmount={getPaymentAmount()}
          remainingBalance={remainingBalance}
          orderTotal={orderTotal}
          tipAmount={tipAmount}
          tipsEnabled={!!cafeSettings?.tips_enabled}
          isFullyPaid={isFullyPaid}
          isZeroTotal={isZeroTotal}
          loading={loading}
          canPay={!!staff?.id && isOnline}
          onCancel={onClose}
          onPay={handlePayment}
          onCompleteOrder={handleCompleteOrder}
          formatPrice={formatPrice}
          t={t}
        />
      </div>
    </div>
  );
}
