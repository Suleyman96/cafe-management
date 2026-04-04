'use client';

import type { Database } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { useCreateStockItem, useUpdateStockItem } from '@/hooks';

type StockItem = Database['public']['Tables']['stock_items']['Row'];

interface StockItemModalProps {
  item?: StockItem;
  onClose: () => void;
}

const UNITS = ['pieces', 'kg', 'liters', 'boxes', 'bags', 'bottles', 'packs'];
const CATEGORIES = [
  'Beverages',
  'Food Supplies',
  'Cleaning Supplies',
  'Equipment',
  'Packaging',
  'Dairy',
  'Produce',
  'Meat',
  'Dry Goods',
  'Other',
];

export function StockItemModal({ item, onClose }: StockItemModalProps) {
  const { t } = useTranslation('staff');
  const isEditing = !!item;
  const createStockItem = useCreateStockItem();
  const updateStockItem = useUpdateStockItem();

  const [formData, setFormData] = useState({
    name: item?.name || '',
    description: item?.description || '',
    category: item?.category || 'Other',
    quantity: item?.quantity?.toString() || '0',
    unit: item?.unit || 'pieces',
    cost_price: item?.cost_price?.toString() || '0',
    minimum_stock_level: item?.minimum_stock_level?.toString() || '0',
    supplier_name: item?.supplier_name || '',
    notes: item?.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const toastId = toast.loading(isEditing ? t('stock.updatingItem') : t('stock.creatingItem'));

    try {
      const baseData = {
        name: formData.name,
        description: formData.description || null,
        category: formData.category,
        unit: formData.unit,
        cost_price: Number.parseFloat(formData.cost_price),
        minimum_stock_level: Number.parseFloat(formData.minimum_stock_level),
        supplier_name: formData.supplier_name || null,
        notes: formData.notes || null,
        is_active: true,
      };

      if (isEditing) {
        // Never overwrite quantity on edit — use stock movements instead
        await updateStockItem.mutateAsync({ id: item.id, updates: baseData });
        toast.success(t('stock.itemUpdated'), { id: toastId });
      } else {
        await createStockItem.mutateAsync({
          ...baseData,
          quantity: Number.parseFloat(formData.quantity),
        });
        toast.success(t('stock.itemCreated'), { id: toastId });
      }

      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('stock.failedSave');
      toast.error(message, { id: toastId });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? t('stock.editStockItem') : t('stock.addStockItem')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('name', { ns: 'common' })} *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder={t('stock.itemName')}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('description', { ns: 'common' })}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder={`${t('description', { ns: 'common' })} (${t('optional', { ns: 'common' }).toLowerCase()})`}
            />
          </div>

          {/* Category + Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('category', { ns: 'common' })} *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('stock.unit')} *
              </label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantity + Cost Price */}
          <div className="grid grid-cols-2 gap-4">
            {!isEditing && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('stock.initialQuantity')}
                </label>
                <NumberInput
                  value={formData.quantity}
                  onChange={(v) => setFormData({ ...formData, quantity: v })}
                  min={0}
                  step={0.01}
                  placeholder="0"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('stock.costPerUnit')}
              </label>
              <NumberInput
                value={formData.cost_price}
                onChange={(v) => setFormData({ ...formData, cost_price: v })}
                min={0}
                step={0.01}
                placeholder="0"
              />
            </div>
          </div>

          {/* Minimum Stock Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('stock.minStockLevel')}
            </label>
            <NumberInput
              value={formData.minimum_stock_level}
              onChange={(v) => setFormData({ ...formData, minimum_stock_level: v })}
              min={0}
              step={0.01}
              placeholder="0"
            />
          </div>

          {/* Supplier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('stock.supplierName')}
            </label>
            <input
              type="text"
              value={formData.supplier_name}
              onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder={`${t('stock.supplierName')} (${t('optional', { ns: 'common' }).toLowerCase()})`}
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
              placeholder={`${t('notes', { ns: 'common' })} (${t('optional', { ns: 'common' }).toLowerCase()})`}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" className="flex-1">
              {isEditing ? t('stock.updateItem') : t('stock.createItem')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
