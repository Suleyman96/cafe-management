'use client';

import type { Database } from '@cafe-idare/database';
import { useTranslation } from '@cafe-idare/i18n';
import { LoadingSpinner } from '@cafe-idare/ui';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { StockItemModal } from '@/components/modals/stock-item-modal';
import { StockMovementModal } from '@/components/modals/stock-movement-modal';
import { Button } from '@/components/ui/button';
import {
  useAuth,
  useDeleteStockItem,
  useLowStockCount,
  useStockItems,
  useStockMovements,
} from '@/hooks';
import { useFormatPrice } from '@/hooks/use-format-price';

type StockItem = Database['public']['Tables']['stock_items']['Row'];

export default function StockPage() {
  const { t } = useTranslation('staff');
  const { staff } = useAuth();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [movementItem, setMovementItem] = useState<{
    item: StockItem;
    type: 'in' | 'out';
  } | null>(null);
  const [historyItem, setHistoryItem] = useState<StockItem | null>(null);

  const { data: stockItems = [], isLoading } = useStockItems();
  const { data: lowStockCount = 0 } = useLowStockCount();
  const formatPrice = useFormatPrice();
  const deleteStockItem = useDeleteStockItem();

  // Redirect if not admin
  if (staff && staff.role !== 'admin' && staff.role !== 'owner') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{t('staffMgmt.accessDenied')}</p>
      </div>
    );
  }

  // Get unique categories
  const categories = [
    ...new Set(stockItems.map((item: StockItem) => item.category)),
  ].sort() as string[];

  // Filter items
  const filteredItems = stockItems.filter((item: StockItem) => {
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.supplier_name?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Calculate total value
  const totalValue = stockItems.reduce(
    (sum: number, item: StockItem) => sum + item.quantity * item.cost_price,
    0,
  );

  const getStockLevelColor = (item: StockItem) => {
    if (item.quantity <= item.minimum_stock_level) return 'text-red-600 bg-red-50';
    if (item.quantity <= item.minimum_stock_level * 1.2) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this stock item?')) return;
    try {
      await deleteStockItem.mutateAsync(id);
      toast.success(t('stock.stockItemDeleted'));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('delete', { ns: 'common' });
      toast.error(message);
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900">{t('stock.title')}</h1>
          <p className="text-gray-500 mt-1">{t('stock.subtitle')}</p>
        </div>
        <Button onClick={() => setShowItemModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('stock.addItem')}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('stock.totalItems')}</p>
              <p className="text-2xl font-bold text-gray-900">{stockItems.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('stock.lowStock')}</p>
              <p className="text-2xl font-bold text-red-600">{lowStockCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('stock.totalValue')}</p>
              <p className="text-2xl font-bold text-gray-900">{formatPrice(totalValue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('stock.searchItems')}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('stock.allCategories')}</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Stock Items Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  {t('name', { ns: 'common' })}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  {t('category', { ns: 'common' })}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  {t('quantity', { ns: 'common' })}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  {t('stock.costUnit')}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  {t('stock.supplier')}
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                  {t('actions', { ns: 'common' })}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredItems.map((item: StockItem) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.description && (
                      <p className="text-sm text-gray-500 truncate max-w-xs">{item.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{item.category}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${getStockLevelColor(item)}`}
                    >
                      {item.quantity} {item.unit}
                    </span>
                    {item.quantity <= item.minimum_stock_level && (
                      <span className="ml-2 text-xs text-red-500">{t('stock.lowIndicator')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatPrice(item.cost_price)}/{item.unit}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.supplier_name || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setMovementItem({ item, type: 'in' })}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                        title={t('stock.addStock')}
                      >
                        <ArrowUpCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setMovementItem({ item, type: 'out' })}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title={t('stock.removeStock')}
                      >
                        <ArrowDownCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setHistoryItem(item)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title={t('stock.viewHistory')}
                      >
                        <History className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setShowItemModal(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                        title={t('edit', { ns: 'common' })}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                        title={t('delete', { ns: 'common' })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    {stockItems.length === 0 ? t('stock.noStockItems') : t('stock.noItemsMatch')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Item Modal */}
      {showItemModal && (
        <StockItemModal
          item={editingItem || undefined}
          onClose={() => {
            setShowItemModal(false);
            setEditingItem(null);
          }}
        />
      )}

      {/* Stock Movement Modal */}
      {movementItem && (
        <StockMovementModal
          item={movementItem.item}
          defaultType={movementItem.type}
          onClose={() => setMovementItem(null)}
        />
      )}

      {/* History Modal */}
      {historyItem && <StockHistoryModal item={historyItem} onClose={() => setHistoryItem(null)} />}
    </div>
  );
}

// Inline history modal component
function StockHistoryModal({ item, onClose }: { item: StockItem; onClose: () => void }) {
  const { t } = useTranslation('staff');
  const { data: movements = [], isLoading } = useStockMovements(item.id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {t('stock.history')} {item.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : movements.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t('stock.stockMovements')}</p>
          ) : (
            <div className="space-y-3">
              {movements.map((m: any) => (
                <div key={m.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div
                    className={`p-1.5 rounded-full ${
                      m.movement_type === 'in'
                        ? 'bg-green-100'
                        : m.movement_type === 'out'
                          ? 'bg-red-100'
                          : 'bg-blue-100'
                    }`}
                  >
                    {m.movement_type === 'in' ? (
                      <ArrowUpCircle className="h-4 w-4 text-green-600" />
                    ) : m.movement_type === 'out' ? (
                      <ArrowDownCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      <History className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {m.movement_type === 'in'
                          ? `+${m.quantity_change}`
                          : m.movement_type === 'out'
                            ? m.quantity_change
                            : `Set to ${m.quantity_after}`}
                      </span>
                      <span className="text-xs text-gray-400">
                        &rarr; {m.quantity_after} {item.unit}
                      </span>
                    </div>
                    {m.reason && <p className="text-sm text-gray-600 mt-0.5">{m.reason}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(m.created_at).toLocaleString()}
                      {m.performed_by_staff && ` by ${m.performed_by_staff.full_name}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-6 py-4">
          <Button variant="outline" onClick={onClose} className="w-full">
            {t('close', { ns: 'common' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
