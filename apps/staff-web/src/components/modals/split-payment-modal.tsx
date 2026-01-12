'use client';

import { useState } from 'react';
import { useCreatePayment, useOrderRemainingBalance } from '@/hooks';
import { Button } from '@cafe-idare/ui';
import { X, DollarSign, CheckCircle } from 'lucide-react';
import type { Database } from '@cafe-idare/database';

type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  menu_item?: Database['public']['Tables']['menu_items']['Row'];
};

// Default staff ID for development (Admin User)
const DEFAULT_STAFF_ID = '10000000-0000-0000-0000-000000000001';

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
  const createPayment = useCreatePayment();
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
        return remainingBalance || orderTotal;
      case 'partial':
        return parseFloat(partialAmount) || 0;
      case 'items':
        return calculateSelectedItemsTotal();
    }
  };

  const handlePayment = async () => {
    const amount = getPaymentAmount();
    if (amount <= 0) return;

    setLoading(true);
    try {
      await createPayment.mutateAsync({
        order_id: order?.id || '',
        received_by: DEFAULT_STAFF_ID,
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

  if (!isOpen || !order) return null;

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
                  <span className="text-orange-600">${remainingBalance.toFixed(2)}</span>
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
                  ${(remainingBalance || orderTotal).toFixed(2)}
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
                  max={remainingBalance || orderTotal}
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
            <span className="text-2xl font-bold text-blue-600">
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
            <Button
              onClick={handlePayment}
              disabled={getPaymentAmount() <= 0 || loading}
              className="flex-1"
            >
              {loading ? 'Processing...' : 'Process Payment'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}