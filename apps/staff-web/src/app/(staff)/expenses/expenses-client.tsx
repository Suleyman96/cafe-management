'use client';

import type { Database } from '@gustri/database/types';
import { useTranslation } from '@gustri/i18n';
import { Button, LoadingSpinner } from '@gustri/ui-web';
import { DollarSign, FolderOpen, Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/modals/confirm-dialog';
import { ExpenseCategoryModal } from '@/components/modals/expense-category-modal';
import { ExpenseModal } from '@/components/modals/expense-modal';
import {
  useDeleteExpense,
  useExpenseCategories,
  useExpenseMonthlySummary,
  useExpenses,
} from '@/hooks';
import { useFormatPrice } from '@/hooks/use-format-price';
import { toastLocalizedError } from '@/lib/toast/localized-error';

type Expense = Database['public']['Tables']['expenses']['Row'];

export default function ExpensesClient() {
  const { t } = useTranslation('staff');
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    cash: t('cash', { ns: 'common' }),
    card: t('card', { ns: 'common' }),
    digital: t('digital', { ns: 'common' }),
    bank_transfer: t('bankTransfer', { ns: 'common' }),
  };

  const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
  const endMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
  const endYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const { data: expenses = [], isLoading } = useExpenses({
    categoryId: categoryFilter || undefined,
    startDate,
    endDate,
    paymentMethod: paymentFilter || undefined,
  });
  const { data: categories = [] } = useExpenseCategories();
  const { data: summary } = useExpenseMonthlySummary(selectedYear, selectedMonth);
  const formatPrice = useFormatPrice();
  const deleteExpense = useDeleteExpense();

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteExpense.mutateAsync(deletingId);
      toast.success(t('expenses.expenseDeleted'));
    } catch (error: unknown) {
      toastLocalizedError(error, t('delete', { ns: 'common' }));
    } finally {
      setDeletingId(null);
    }
  };

  // Month selector options — use locale-aware month names
  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(new Date().getFullYear(), i).toLocaleString('default', { month: 'long' }),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('expenses.title')}</h1>
          <p className="text-gray-500 mt-1">{t('expenses.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCategoryModal(true)}>
            <Settings className="h-4 w-4 mr-2" />
            {t('expenses.categories')}
          </Button>
          <Button onClick={() => setShowExpenseModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('expenses.addExpense')}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <DollarSign className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('expenses.totalThisMonth')}</p>
              <p className="text-2xl font-bold text-gray-900">{formatPrice(summary?.total || 0)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FolderOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('expenses.transactions')}</p>
              <p className="text-2xl font-bold text-gray-900">{summary?.count || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <FolderOpen className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('expenses.topCategory')}</p>
              <p className="text-lg font-bold text-gray-900 truncate">
                {summary?.byCategory?.[0]?.name || '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {summary?.byCategory && summary.byCategory.length > 0 && (
        <div className="bg-white rounded-lg border p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">{t('expenses.byCategory')}</h3>
          <div className="space-y-2">
            {summary.byCategory.map((cat) => {
              const percentage = summary.total > 0 ? (cat.total / summary.total) * 100 : 0;
              return (
                <div key={cat.name} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-28 truncate">{cat.name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-20 text-right">
                    {formatPrice(cat.total)}
                  </span>
                  <span className="text-xs text-gray-400 w-8 text-right">
                    {percentage.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number.parseInt(e.target.value, 10))}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {Array.from({ length: 2 }, (_, i) => {
            const y = now.getFullYear() - i;
            return (
              <option key={y} value={y}>
                {y}
              </option>
            );
          })}
        </select>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number.parseInt(e.target.value, 10))}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {months.map((name) => (
            <option key={name} value={months.indexOf(name) + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('expenses.allCategories')}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('expenses.allPaymentMethods')}</option>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  {t('date', { ns: 'common' })}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  {t('description', { ns: 'common' })}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  {t('category', { ns: 'common' })}
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                  {t('amount', { ns: 'common' })}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  {t('expenses.paymentMethod')}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  {t('staffMgmt.staffMember')}
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                  {t('actions', { ns: 'common' })}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {expenses.map(
                (
                  expense: (typeof expenses)[number] & {
                    category?: { name: string } | null;
                    created_by_staff?: { full_name: string } | null;
                  },
                ) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(expense.expense_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-xs">
                        {expense.description}
                      </p>
                      {expense.notes && (
                        <p className="text-xs text-gray-500 truncate max-w-xs">{expense.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {expense.category?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                      {formatPrice(expense.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {PAYMENT_METHOD_LABELS[expense.payment_method] || expense.payment_method}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {expense.created_by_staff?.full_name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingExpense(expense);
                            setShowExpenseModal(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                          title={t('edit', { ns: 'common' })}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingId(expense.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                          title={t('delete', { ns: 'common' })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {t('expenses.noExpenses')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Modal */}
      {showExpenseModal && (
        <ExpenseModal
          expense={editingExpense || undefined}
          onClose={() => {
            setShowExpenseModal(false);
            setEditingExpense(null);
          }}
        />
      )}

      {/* Category Management Modal */}
      {showCategoryModal && <ExpenseCategoryModal onClose={() => setShowCategoryModal(false)} />}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleConfirmDelete}
        title={t('delete', { ns: 'common' })}
        message={t('expenses.deleteExpenseConfirm')}
      />
    </div>
  );
}
