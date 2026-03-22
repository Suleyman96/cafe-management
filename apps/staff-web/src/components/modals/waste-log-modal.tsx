'use client';

import type { Database } from '@cafe-idare/database';
import { useTranslation } from '@cafe-idare/i18n';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  useAdjustStock,
  useAuth,
  useCreateWasteLog,
  useStockItems,
  useUpdateWasteLog,
} from '@/hooks';

type WasteLog = Database['public']['Tables']['waste_logs']['Row'];

interface WasteLogModalProps {
  wasteLog?: WasteLog;
  onClose: () => void;
}

const WASTE_REASONS = [
  { value: 'expired', i18nKey: 'waste.expired' },
  { value: 'spoiled', i18nKey: 'waste.spoiled' },
  { value: 'overcooked', i18nKey: 'waste.overcooked' },
  { value: 'dropped', i18nKey: 'waste.dropped' },
  { value: 'returned_by_customer', i18nKey: 'waste.returnedByCustomer' },
  { value: 'preparation_waste', i18nKey: 'waste.preparationWaste' },
  { value: 'other', i18nKey: 'waste.other' },
];

export function WasteLogModal({ wasteLog, onClose }: WasteLogModalProps) {
  const { t } = useTranslation('staff');
  const isEditing = !!wasteLog;
  const createWaste = useCreateWasteLog();
  const updateWaste = useUpdateWasteLog();
  const adjustStock = useAdjustStock();
  const { data: stockItems = [] } = useStockItems();
  const { staff } = useAuth();

  const [formData, setFormData] = useState({
    item_name: wasteLog?.item_name || '',
    category: wasteLog?.category || 'General',
    quantity: wasteLog?.quantity?.toString() || '',
    unit: wasteLog?.unit || 'pieces',
    cost_per_unit: wasteLog?.cost_per_unit?.toString() || '0',
    total_cost: wasteLog?.total_cost?.toString() || '0',
    reason: wasteLog?.reason || 'expired',
    stock_item_id: wasteLog?.stock_item_id || '',
    waste_date: wasteLog?.waste_date || new Date().toISOString().split('T')[0],
    notes: wasteLog?.notes || '',
    deduct_from_stock: true,
  });

  const handleStockItemSelect = (stockItemId: string) => {
    if (!stockItemId) {
      setFormData({ ...formData, stock_item_id: '', deduct_from_stock: false });
      return;
    }
    const item = stockItems.find((s) => s.id === stockItemId);
    if (item) {
      const qty = Number.parseFloat(formData.quantity) || 0;
      setFormData({
        ...formData,
        stock_item_id: stockItemId,
        item_name: item.name,
        unit: item.unit,
        cost_per_unit: item.cost_price?.toString() || '0',
        total_cost: (qty * (item.cost_price || 0)).toFixed(2),
        category: item.category || 'General',
        deduct_from_stock: true,
      });
    }
  };

  const handleQuantityChange = (value: string) => {
    const qty = Number.parseFloat(value) || 0;
    const costPerUnit = Number.parseFloat(formData.cost_per_unit) || 0;
    setFormData({
      ...formData,
      quantity: value,
      total_cost: (qty * costPerUnit).toFixed(2),
    });
  };

  const handleCostChange = (value: string) => {
    const qty = Number.parseFloat(formData.quantity) || 0;
    const costPerUnit = Number.parseFloat(value) || 0;
    setFormData({
      ...formData,
      cost_per_unit: value,
      total_cost: (qty * costPerUnit).toFixed(2),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const quantity = Number.parseFloat(formData.quantity);
    if (!quantity || quantity <= 0) {
      toast.error(t('waste.validQuantity'));
      return;
    }

    const toastId = toast.loading(isEditing ? t('waste.updatingWaste') : t('waste.loggingWaste'));

    try {
      const data = {
        item_name: formData.item_name,
        category: formData.category,
        quantity,
        unit: formData.unit,
        cost_per_unit: Number.parseFloat(formData.cost_per_unit) || 0,
        total_cost: Number.parseFloat(formData.total_cost) || 0,
        reason: formData.reason as WasteLog['reason'],
        stock_item_id: formData.stock_item_id || null,
        waste_date: formData.waste_date,
        notes: formData.notes || null,
        logged_by: staff?.id || null,
      };

      if (isEditing) {
        await updateWaste.mutateAsync({ id: wasteLog.id, updates: data });
        toast.success(t('waste.wasteLogUpdated'), { id: toastId });
      } else {
        await createWaste.mutateAsync(data);

        // Deduct from stock if selected
        if (formData.deduct_from_stock && formData.stock_item_id) {
          try {
            await adjustStock.mutateAsync({
              id: formData.stock_item_id,
              data: {
                type: 'out',
                quantity,
                reason: `Waste: ${formData.reason}`,
                performedBy: staff?.id,
              },
            });
          } catch {
            toast.error(t('waste.wasteButNoStock'));
          }
        }

        toast.success(t('waste.wasteLogged'), { id: toastId });
      }

      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('waste.failedLog');
      toast.error(message, { id: toastId });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? t('waste.editWasteLog') : t('waste.logWaste')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Stock Item Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('waste.linkToStockItem')}
            </label>
            <select
              value={formData.stock_item_id}
              onChange={(e) => handleStockItemSelect(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('waste.manualEntry')}</option>
              {stockItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.quantity} {item.unit} in stock)
                </option>
              ))}
            </select>
          </div>

          {/* Item Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('waste.itemName')} *
            </label>
            <input
              type="text"
              value={formData.item_name}
              onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder={t('waste.whatWasWasted')}
            />
          </div>

          {/* Quantity + Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('quantity', { ns: 'common' })} *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('stock.unit')}
              </label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="pieces, kg, liters..."
              />
            </div>
          </div>

          {/* Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('waste.costPerUnit')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.cost_per_unit}
                onChange={(e) => handleCostChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('waste.totalCost')}
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.total_cost}
                onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50"
                readOnly
              />
            </div>
          </div>

          {/* Reason + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('waste.wasteReason')} *
              </label>
              <select
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value as WasteLog['reason'] })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {WASTE_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {t(r.i18nKey)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('waste.wasteDate')} *
              </label>
              <input
                type="date"
                value={formData.waste_date}
                onChange={(e) => setFormData({ ...formData, waste_date: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Deduct from stock checkbox */}
          {!isEditing && formData.stock_item_id && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="deduct_stock"
                checked={formData.deduct_from_stock}
                onChange={(e) => setFormData({ ...formData, deduct_from_stock: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="deduct_stock" className="text-sm text-gray-700">
                {t('waste.deductFromStock')}
              </label>
            </div>
          )}

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
              placeholder={t('notes', { ns: 'common' })}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" className="flex-1">
              {isEditing ? t('tasks.update') : t('waste.logWaste')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
