'use client';

import { useState } from 'react';
import { useCreatePayment, useOrderRemainingBalance, useUpdateOrderStatus } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@cafe-idare/ui';
import { X, DollarSign, CheckCircle, Check } from 'lucide-react';
import { ORDER_STATUS } from '@cafe-idare/core';
import type { Database } from '@cafe-idare/database';

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

export function SplitPaymentModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: SplitPaymentModalProps) {
  const { staff } = useAuth();
  const createPayment = useCreatePayment();
  const updateOrderStatus = useUpdateOrderStatus();
  const { data: remainingBalance } = useOrderRemainingBalance(order?.id || '');

  const [paymentMode, setPaymentMode] = useState<PaymentMode>('full');
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const orderTotal = order?.order_items?.reduce(
    (sum: number, item: OrderItem) => sum + item.quantity * item.item_price,
    0
  ) || 0;

  const calculateSelectedItemsTotal = () => {
    if (!order?.order_items) return 0;
    return order.order_items
      .filter((item: OrderItem) => selectedItems.has(item.id))
      .reduce((sum: number, item: OrderItem) => sum + item.quantity * item.item_price, 0);
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
    const amount = getPaymentAmount();
    if (amount <= 0 || !staff?.id) return;

    setLoading(true);
    try {
      await createPayment.mutateAsync({
        order_id: order?.id || '',
        received_by: staff.id,
        payment_type: paymentMode === 'full' ? 'full' :
                     paymentMode === 'partial' ? 'partial_amount' :
                     'specific_items',
        amount,
        payment_method: 'cash',
        order_item_ids: paymentMode === 'items' ? Array.from(selectedItems) : null,
        notes: null,
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to process payment:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">Process Payment (Cash)</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
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
                  {isZeroTotal
                    ? 'This order has no items to pay for.'
                    : 'This order has been fully paid!'}
                </span>
              </div>
              <p className="text-sm text-green-600 mt-2">
                Click "Complete Order" to close this order.
              </p>
            </div>
          )}

          {/* Order Summary */}
          <div className="mb-6">
            <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
              <span>Order Total</span>
              <span className="font-medium">${orderTotal.toFixed(2)}</span>
            </div>
            {(remainingBalance !== undefined && remainingBalance < orderTotal) && (
              <>
                <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                  <span>Already Paid</span>
                  <span className="font-medium text-green-600">
                    ${(orderTotal - remainingBalance).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center font-medium">
                  <span>Remaining Balance</span>
                  <span className={isFullyPaid ? "text-green-600" : "text-orange-600"}>
                    ${remainingBalance.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Payment Mode Selection */}
          <div className="space-y-3 mb-6">
            <label className="block text-sm font-medium text-gray-700">
              Payment Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setPaymentMode('full')}
                className={`p-3 border rounded-lg text-center transition-colors ${
                  paymentMode === 'full'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <DollarSign className="h-5 w-5 mx-auto mb-1" />
                <div className="text-sm font-medium">Full Payment</div>
                <div className="text-xs text-gray-600">
                  ${(remainingBalance ?? orderTotal).toFixed(2)}
                </div>
              </button>

              <button
                onClick={() => setPaymentMode('partial')}
                className={`p-3 border rounded-lg text-center transition-colors ${
                  paymentMode === 'partial'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <DollarSign className="h-5 w-5 mx-auto mb-1" />
                <div className="text-sm font-medium">Partial Amount</div>
                <div className="text-xs text-gray-600">Custom amount</div>
              </button>

              <button
                onClick={() => setPaymentMode('items')}
                className={`p-3 border rounded-lg text-center transition-colors ${
                  paymentMode === 'items'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <CheckCircle className="h-5 w-5 mx-auto mb-1" />
                <div className="text-sm font-medium">Specific Items</div>
                <div className="text-xs text-gray-600">Select items</div>
              </button>
            </div>
          </div>

          {/* Partial Amount Input */}
          {paymentMode === 'partial' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount to Pay
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  max={remainingBalance ?? orderTotal}
                />
              </div>
            </div>
          )}

          {/* Item Selection */}
          {paymentMode === 'items' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Items to Pay For
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {order.order_items?.map((item: OrderItem) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => toggleItemSelection(item.id)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        {item.quantity}x {item.item_name}
                      </div>
                      {item.notes && (
                        <div className="text-xs text-gray-600">{item.notes}</div>
                      )}
                    </div>
                    <div className="font-medium">
                      ${(item.quantity * item.item_price).toFixed(2)}
                    </div>
                  </label>
                ))}
              </div>
              {selectedItems.size > 0 && (
                <div className="mt-2 text-sm font-medium text-blue-700">
                  Total: ${calculateSelectedItemsTotal().toFixed(2)}
                </div>
              )}
            </div>
          )}

        </div>

        <div className="border-t p-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-medium">Amount to Pay</span>
            <span className={`text-2xl font-bold ${isFullyPaid ? 'text-green-600' : 'text-blue-600'}`}>
              ${getPaymentAmount().toFixed(2)}
            </span>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            {isFullyPaid || isZeroTotal ? (
              <Button
                onClick={handleCompleteOrder}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                {loading ? 'Completing...' : 'Complete Order'}
              </Button>
            ) : (
              <Button
                onClick={handlePayment}
                disabled={getPaymentAmount() <= 0 || loading || !staff?.id}
                className="flex-1"
              >
                {loading ? 'Processing...' : 'Process Payment'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}