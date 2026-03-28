'use client';

import { getLocalDateString } from '@gustri/core';
import type { Database } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { useState } from 'react';
import { toast } from 'sonner';
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
  const { t } = useTranslation('staff');
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
    expense_date: expense?.expense_date || getLocalDateString(),
    notes: expense?.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = Number.parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      toast.error(t('expenses.validAmount'));
      return;
    }

    const toastId = toast.loading(
      isEditing ? t('expenses.updatingExpense') : t('expenses.creatingExpense'),
    );

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
        toast.success(t('expenses.expenseUpdated'), { id: toastId });
      } else {
        await createExpense.mutateAsync(data);
        toast.success(t('expenses.expenseCreated'), { id: toastId });
      }

      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('expenses.failedSave');
      toast.error(message, { id: toastId });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? t('expenses.editExpense') : t('expenses.addExpense')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('expenses.expenseAmount')} *
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('expenses.expenseDescription')} *
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder={t('expenses.whatExpenseFor')}
            />
          </div>

          {/* Category + Payment Method */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('category', { ns: 'common' })}
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('expenses.noCategory')}</option>
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('expenses.paymentMethod')} *
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
                    {pm.value === 'bank_transfer'
                      ? t('bankTransfer', { ns: 'common' })
                      : t(pm.value, { ns: 'common' })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('expenses.expenseDate')} *
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('notes', { ns: 'common' })}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder={t('expenses.optionalNotes')}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" className="flex-1">
              {isEditing ? t('expenses.updateExpense') : t('expenses.addExpense')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
