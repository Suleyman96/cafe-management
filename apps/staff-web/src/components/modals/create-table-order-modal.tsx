'use client';

import { UtensilsCrossed, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCreateOrder } from '@/hooks';

interface CreateTableOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
  table: {
    id: string;
    table_number: string;
  };
}

export function CreateTableOrderModal({
  isOpen,
  onClose,
  onSuccess,
  table,
}: CreateTableOrderModalProps) {
  const createOrder = useCreateOrder();

  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    console.log('Creating order for table:', table.id);
    setLoading(true);
    try {
      const result = await createOrder.mutateAsync({
        table_id: table.id,
        order_type: 'dine_in',
        status: 'new',
        internal_notes: notes.trim() || null,
      } as any);
      console.log('Order created:', result);
      onSuccess(result.id);

      // Reset form
      setNotes('');
    } catch (error) {
      console.error('Failed to create table order:', error);
      toast.error('Failed to create order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Create Order for {table.table_number}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <UtensilsCrossed className="inline h-4 w-4 mr-1" />
              Notes (optional)
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Special requests, allergies, etc."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
          <p className="text-sm text-green-800">
            This will create a new dine-in order for {table.table_number}. You can add menu items in
            the next screen.
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={loading} className="flex-1">
            {loading ? 'Creating...' : 'Create Order'}
          </Button>
        </div>
      </div>
    </div>
  );
}
