'use client';

import type { ORDER_STATUS } from '@gustri/core';
import type { Database } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import { Check, CheckCircle, X } from 'lucide-react';
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
import { ItemPaymentForm } from './payment/item-payment-form';
import { PartialPaymentForm } from './payment/partial-payment-form';
import { PaymentModeSelector } from './payment/payment-mode-selector';

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

  const [paymentMode, setPaymentMode] = useState<PaymentMode>('full');
  const [partialAmount, setPartialAmount] = useState<string>('');
  // Map of itemId → selected quantity (0 means not selected)
  const [selectedItemQuantities, setSelectedItemQuantities] = useState<Map<string, number>>(
    new Map(),
  );
  const [tipAmount, setTipAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'digital'>('cash');
  const [loading, setLoading] = useState(false);

  // Reset selection state when modal opens to clear stale data from previous sessions
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
  const orderSubtotal = order?.subtotal || itemsSubtotalCalc;
  const orderTax = order?.tax || 0;
  const orderTotal = order?.total || orderSubtotal + orderTax;

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
    if (amount <= 0 || !staff?.id) return;

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

    setLoading(true);
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
      });
      onSuccess();
    } catch (error: unknown) {
      console.error('Failed to process payment:', error);
      const message = error instanceof Error ? error.message : t('payment.paymentFailed');
      toast.error(message);
    } finally {
      setLoading(false);
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

    setLoading(true);
    try {
      await updateOrderStatus.mutateAsync({
        orderId: order.id,
        status: 'CLOSED' as keyof typeof ORDER_STATUS,
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to complete order:', error);
    } finally {
      setLoading(false);
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
          {/* Fully Paid / Zero Total Message */}
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

          {/* Order Summary */}
          <div className="mb-6">
            {orderTax > 0 && (
              <>
                <div className="flex justify-between items-center text-sm text-gray-600 mb-1">
                  <span>{t('subtotal', { ns: 'common' })}</span>
                  <span>{formatPrice(orderSubtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                  <span>{t('orders.tax')}</span>
                  <span>{formatPrice(orderTax)}</span>
                </div>
              </>
            )}
            <div
              className={`flex justify-between items-center text-sm font-medium mb-2 ${orderTax > 0 ? 'pt-2 border-t' : ''}`}
            >
              <span>{t('payment.orderTotal')}</span>
              <span>{formatPrice(orderTotal)}</span>
            </div>
            {remainingBalance !== undefined && remainingBalance < orderTotal && (
              <>
                <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                  <span>{t('payment.alreadyPaid')}</span>
                  <span className="font-medium text-green-600">
                    {formatPrice(orderTotal - remainingBalance)}
                  </span>
                </div>
                <div className="flex justify-between items-center font-medium">
                  <span>{t('payment.remainingBalance')}</span>
                  <span className={isFullyPaid ? 'text-green-600' : 'text-orange-600'}>
                    {formatPrice(remainingBalance)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Payment Mode Selection */}
          <PaymentModeSelector
            paymentMode={paymentMode}
            onModeChange={setPaymentMode}
            remainingBalance={remainingBalance}
            orderTotal={orderTotal}
            formatPrice={formatPrice}
            t={t}
          />

          {/* Partial Amount Input */}
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

          {/* Item Selection with Quantity Controls */}
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

          {/* Payment Method */}
          {!isFullyPaid && !isZeroTotal && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('payment.paymentMethod')}
              </label>
              <div className="flex gap-2">
                {(['cash', 'card', 'digital'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      paymentMethod === method
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {t(method, { ns: 'common' })}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tip Input - only shown when tips are enabled */}
          {cafeSettings?.tips_enabled && !isFullyPaid && !isZeroTotal && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('payment.addTip')}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  {cafeSettings.currency_symbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                />
              </div>
              {parseFloat(tipAmount) > 0 && (
                <div className="mt-2 text-sm text-green-600">
                  {t('orders.tip')}: {formatPrice(parseFloat(tipAmount))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t p-6">
          {/* Payment Summary with Tip */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('payment.paymentType')}</span>
              <span className="font-medium">{formatPrice(getPaymentAmount())}</span>
            </div>
            {cafeSettings?.tips_enabled && parseFloat(tipAmount) > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('orders.tip')}</span>
                <span className="font-medium text-green-600">
                  {formatPrice(parseFloat(tipAmount))}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-lg font-medium">{t('payment.totalToCollect')}</span>
              <span
                className={`text-2xl font-bold ${isFullyPaid ? 'text-green-600' : 'text-blue-600'}`}
              >
                {formatPrice(getPaymentAmount() + (parseFloat(tipAmount) || 0))}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
              {t('cancel', { ns: 'common' })}
            </Button>
            {isFullyPaid || isZeroTotal ? (
              <Button
                onClick={handleCompleteOrder}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                {loading ? t('payment.completing') : t('payment.completeOrder')}
              </Button>
            ) : (
              <Button
                onClick={handlePayment}
                disabled={
                  getPaymentAmount() <= 0 ||
                  getPaymentAmount() > (remainingBalance ?? orderTotal) + 0.01 ||
                  loading ||
                  !staff?.id
                }
                className="flex-1"
              >
                {loading ? t('payment.processing') : t('payment.processPaymentBtn')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
