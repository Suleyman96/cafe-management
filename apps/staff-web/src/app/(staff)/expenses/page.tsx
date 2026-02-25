'use client';

import type { Database } from '@cafe-idare/database';
import { LoadingSpinner } from '@cafe-idare/ui';
import { DollarSign, FolderOpen, Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ExpenseCategoryModal } from '@/components/modals/expense-category-modal';
import { ExpenseModal } from '@/components/modals/expense-modal';
import { Button } from '@/components/ui/button';
import {
  formatPriceWithSettings,
  useAuth,
  useCafeSettings,
  useDeleteExpense,
  useExpenseCategories,
  useExpenseMonthlySummary,
  useExpenses,
} from '@/hooks';

type Expense = Database['public']['Tables']['expenses']['Row'];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  digital: 'Digital',
  bank_transfer: 'Bank Transfer',
};

export default function ExpensesPage() {
  const { staff } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

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
  const { data: cafeSettings } = useCafeSettings();
  const deleteExpense = useDeleteExpense();

  const formatPrice = (amount: number) => {
    if (cafeSettings) {
      return formatPriceWithSettings(amount, cafeSettings);
    }
    return `$${amount.toFixed(2)}`;
  };

  // Redirect if not admin
  if (staff && staff.role !== 'admin' && staff.role !== 'owner') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Admin access required</p>
      </div>
    );
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await deleteExpense.mutateAsync(id);
      toast.success('Expense deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    }
  };

  // Month selector options
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

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
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500 mt-1">Track and manage operational costs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCategoryModal(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Categories
          </Button>
          <Button onClick={() => setShowExpenseModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
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
              <p className="text-sm text-gray-500">Total This Month</p>
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
              <p className="text-sm text-gray-500">Transactions</p>
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
              <p className="text-sm text-gray-500">Top Category</p>
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
          <h3 className="text-sm font-medium text-gray-700 mb-3">By Category</h3>
          <div className="space-y-2">
            {summary.byCategory.map((cat: any) => {
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
          <option value="">All Categories</option>
          {categories.map((cat: any) => (
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
          <option value="">All Payment Methods</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="digital">Digital</option>
          <option value="bank_transfer">Bank Transfer</option>
        </select>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Date</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  Description
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Category</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Amount</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Payment</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">By</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {expenses.map((expense: any) => (
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
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No expenses recorded for this period.
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
    </div>
  );
}
