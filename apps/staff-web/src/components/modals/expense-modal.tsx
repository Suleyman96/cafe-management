'use client';

import type { Database } from '@cafe-idare/database';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { useAuth, useCreateExpense, useExpenseCategories, useUpdateExpense } from '@/hooks';

type Expense = Database['public']['Tables']['expenses']['Row'];

interface ExpenseModalProps {
  expense?: Expense;
  onClose: () => void;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'digital', label: 'Digital' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export function ExpenseModal({ expense, onClose }: ExpenseModalProps) {
  const isEditing = !!expense;
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const { data: categories = [] } = useExpenseCategories();
  const { staff } = useAuth();

  const [formData, setFormData] = useState({
    amount: expense?.amount?.toString() || '',
    description: expense?.description || '',
    category_id: expense?.category_id || '',
    payment_method: expense?.payment_method || 'cash',
    expense_date: expense?.expense_date || new Date().toISOString().split('T')[0],
    notes: expense?.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = Number.parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const toastId = toast.loading(isEditing ? 'Updating expense...' : 'Creating expense...');

    try {
      const data = {
        amount,
        description: formData.description,
        category_id: formData.category_id || null,
        payment_method: formData.payment_method as 'cash' | 'card' | 'digital' | 'bank_transfer',
        expense_date: formData.expense_date,
        notes: formData.notes || null,
        created_by: staff?.id || null,
        receipt_url: null,
      };

      if (isEditing) {
        await updateExpense.mutateAsync({ id: expense.id, updates: data });
        toast.success('Expense updated!', { id: toastId });
      } else {
        await createExpense.mutateAsync(data);
        toast.success('Expense created!', { id: toastId });
      }

      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save expense', { id: toastId });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Expense' : 'Add Expense'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="What was this expense for?"
            />
          </div>

          {/* Category + Payment Method */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No category</option>
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method *
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    payment_method: e.target.value as 'cash' | 'card' | 'digital' | 'bank_transfer',
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
            <input
              type="date"
              value={formData.expense_date}
              onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Optional notes"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {isEditing ? 'Update Expense' : 'Add Expense'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
