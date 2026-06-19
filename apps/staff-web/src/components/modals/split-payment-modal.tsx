'use client';

import type { ORDER_STATUS } from '@gustri/core';
import type { Database } from '@gustri/database/types';
import { useTranslation } from '@gustri/i18n';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
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
import { resolveLocalizedErrorMessage, toastLocalizedError } from '@/lib/toast/localized-error';
import { CashTenderedInput } from './payment/cash-tendered-input';
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
  // Cash-handed-over, used only to compute change due. Display aid for the
  // cashier — it never changes the amount sent to the server.
  const [cashReceived, setCashReceived] = useState<string>('');
  // Inline error surfaced after a failed payment attempt. The toast also fires
  // (so the failure is visible if the cashier looked away), but the toast
  // dismisses; this state persists in the modal until the user actively
  // changes the form OR successfully completes the payment. The user-facing
  // copy explicitly tells the cashier that retrying is safe because the
  // server-side `(tenant_id, client_request_id)` unique index dedupes — a
  // network blip that lost the response will replay against the existing
  // payment row, never create a second one.
  const [paymentError, setPaymentError] = useState<string | null>(null);

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
      setCashReceived('');
      setPaymentError(null);
    }
  }, [isOpen]);

  // Count already-paid UNITS per line item. specific_items payments carry one
  // order_item_ids element per paid unit (duplicates = quantity), so a multi-
  // unit line can be paid down a few units at a time.
  const paidQtyByItem = new Map<string, number>();
  if (existingPayments) {
    for (const payment of existingPayments) {
      if (payment.payment_type === 'specific_items' && payment.order_item_ids) {
        for (const id of payment.order_item_ids) {
          paidQtyByItem.set(id, (paidQtyByItem.get(id) ?? 0) + 1);
        }
      }
    }
  }

  // Filter out cancelled items for payment
  const payableItems =
    order?.order_items?.filter((item: OrderItem) => item.status !== 'cancelled') || [];

  // Units still owed per line item, and the lines that still have any.
  const remainingByItem = new Map<string, number>(
    payableItems.map((item: OrderItem) => [
      item.id,
      item.quantity - (paidQtyByItem.get(item.id) ?? 0),
    ]),
  );
  const unpaidItems = payableItems.filter(
    (item: OrderItem) => (remainingByItem.get(item.id) ?? 0) > 0,
  );

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
      // Items mode → specific_items, with ONE order_item_ids element per selected
      // unit (quantity-aware). The validate_items_payment trigger sums per
      // element, adds proportional tax, and caps each line at its ordered
      // quantity (counting prior payments), so already-paid units can't be paid
      // again — works with or without tax, and for partial quantities.
      paymentType = 'specific_items';
      const selectableIds = new Set(unpaidItems.map((i: OrderItem) => i.id));
      orderItemIds = Array.from(selectedItemQuantities.entries())
        .filter(([id, qty]) => qty > 0 && selectableIds.has(id))
        .flatMap(([id, qty]) => Array.from({ length: qty }, () => id));
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
      setPaymentError(null);
      onSuccess();
    } catch (error: unknown) {
      Sentry.captureException(error);
      const message = resolveLocalizedErrorMessage(error, t('payment.paymentFailed'));
      // Toast for the immediate "something happened" cue. The inline banner
      // below picks up the same resolved message so the cashier still has it
      // in front of them after the toast dismisses.
      toastLocalizedError(error, t('payment.paymentFailed'));
      setPaymentError(message);
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
          <h2 className="text-xl font-bold">{t('payment.processPaymentBtn')}</h2>
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

          {paymentError !== null && !isFullyPaid && !isZeroTotal && (
            <div
              className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg"
              role="alert"
              aria-live="assertive"
            >
              <div className="flex items-start gap-2 text-amber-800">
                <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">{t('payment.failureBannerTitle')}</p>
                  <p className="text-sm mt-1 break-words">{paymentError}</p>
                  <p className="text-sm mt-2 text-amber-700">
                    {t('payment.failureBannerSafeRetry')}
                  </p>
                </div>
              </div>
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

          {/* Method first: cash vs card is the cashier's opening decision and
              drives the cash-tendered helper below. */}
          {!isFullyPaid && !isZeroTotal && (
            <PaymentMethodSelector
              paymentMethod={paymentMethod}
              onMethodChange={setPaymentMethod}
              t={t}
            />
          )}

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
              remainingByItem={remainingByItem}
              selectedItemQuantities={selectedItemQuantities}
              onUpdateQuantity={updateItemQuantity}
              selectedItemsTotal={calculateSelectedItemsTotal()}
              hasSelectedItems={hasSelectedItems}
              formatPrice={formatPrice}
              t={t}
            />
          )}

          {/* Explain the disabled Pay button when the selected items are worth
              more than what's still owed (e.g. a partial payment already covered
              part of the bill). Without this the button just silently disables. */}
          {paymentMode === 'items' &&
            hasSelectedItems &&
            calculateSelectedItemsTotal() > (remainingBalance ?? orderTotal) + 0.01 && (
              <p className="-mt-3 mb-6 text-sm text-red-600">
                {t('payment.exceedsBalance', {
                  amount: formatPrice(calculateSelectedItemsTotal()),
                  balance: formatPrice(remainingBalance ?? orderTotal),
                })}
              </p>
            )}

          {cafeSettings?.tips_enabled && !isFullyPaid && !isZeroTotal && (
            <TipInput
              tipAmount={tipAmount}
              onTipChange={setTipAmount}
              baseAmount={getPaymentAmount()}
              currencySymbol={cafeSettings.currency_symbol}
              formatPrice={formatPrice}
              t={t}
            />
          )}

          {/* Cash-tendered → change due. Only relevant when paying by cash;
              purely a cashier aid (does not alter the amount charged). */}
          {paymentMethod === 'cash' && !isFullyPaid && !isZeroTotal && (
            <CashTenderedInput
              totalToCollect={getPaymentAmount() + (parseFloat(tipAmount) || 0)}
              cashReceived={cashReceived}
              onCashReceivedChange={setCashReceived}
              currencySymbol={cafeSettings?.currency_symbol || '$'}
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
          isRetry={paymentError !== null}
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
