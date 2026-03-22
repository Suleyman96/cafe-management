'use client';

import type { OrdersInsert } from '@cafe-idare/database';
import { Phone, User, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCreateOrder } from '@/hooks';

interface CreateTakeoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}

export function CreateTakeoutModal({ isOpen, onClose, onSuccess }: CreateTakeoutModalProps) {
  const createOrder = useCreateOrder();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!customerName.trim()) return;

    setLoading(true);
    try {
      // TODO: type properly - DB defaults handle missing required fields (subtotal, tax, total, etc.)
      const result = await createOrder.mutateAsync({
        order_type: 'takeout',
        status: 'new',
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
      } as Partial<OrdersInsert> as OrdersInsert);
      onSuccess(result.id);

      // Reset form
      setCustomerName('');
      setCustomerPhone('');
    } catch (error) {
      console.error('Failed to create takeout order:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Create Takeout Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="inline h-4 w-4 mr-1" />
              Customer Name
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="John Doe"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Phone className="inline h-4 w-4 mr-1" />
              Phone Number (optional)
            </label>
            <input
              type="tel"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+1 234 567 8900"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
          <p className="text-sm text-blue-800">
            This will create a new takeout order. You can add items to the order in the next screen.
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!customerName.trim() || loading}
            className="flex-1"
          >
            {loading ? 'Creating...' : 'Create Order'}
          </Button>
        </div>
      </div>
    </div>
  );
}
