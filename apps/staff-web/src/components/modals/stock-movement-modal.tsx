'use client';

import type { Database } from '@cafe-idare/database';
import { useTranslation } from '@cafe-idare/i18n';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { useAdjustStock, useAuth } from '@/hooks';

type StockItem = Database['public']['Tables']['stock_items']['Row'];

interface StockMovementModalProps {
  item: StockItem;
  defaultType?: 'in' | 'out';
  onClose: () => void;
}

export function StockMovementModal({ item, defaultType = 'in', onClose }: StockMovementModalProps) {
  const { t } = useTranslation('staff');
  const adjustStock = useAdjustStock();
  const { staff } = useAuth();

  const [formData, setFormData] = useState({
    type: defaultType as 'in' | 'out' | 'adjustment',
    quantity: '',
    reason: '',
  });

  const getNewQuantity = () => {
    const qty = Number.parseFloat(formData.quantity) || 0;
    if (formData.type === 'in') return item.quantity + qty;
    if (formData.type === 'out') return item.quantity - qty;
    return qty; // adjustment sets absolute value
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const qty = Number.parseFloat(formData.quantity);
    if (!qty || qty <= 0) {
      toast.error(t('stock.validQuantity'));
      return;
    }

    if (formData.type === 'out' && qty > item.quantity) {
      toast.error(t('stock.cannotRemoveMore'));
      return;
    }

    const toastId = toast.loading(t('stock.adjusting'));

    try {
      await adjustStock.mutateAsync({
        id: item.id,
        data: {
          type: formData.type,
          quantity: qty,
          reason: formData.reason || undefined,
          performedBy: staff?.id,
        },
      });
      toast.success(t('stock.adjusted'), { id: toastId });
      onClose();
    } catch (error: any) {
      toast.error(error.message || t('stock.failedAdjust'), { id: toastId });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {t('stock.adjustStock', { name: item.name })}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Current Stock */}
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-sm text-gray-500">{t('stock.currentStock')}</p>
            <p className="text-2xl font-bold text-gray-900">
              {item.quantity} {item.unit}
            </p>
          </div>

          {/* Movement Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('stock.movementType')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['in', 'out', 'adjustment'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({ ...formData, type })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                    formData.type === type
                      ? type === 'in'
                        ? 'bg-green-50 border-green-500 text-green-700'
                        : type === 'out'
                          ? 'bg-red-50 border-red-500 text-red-700'
                          : 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {type === 'in'
                    ? t('stock.addPlus')
                    : type === 'out'
                      ? t('stock.removeMinus')
                      : t('stock.setTo')}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {formData.type === 'adjustment'
                ? t('stock.newQuantity')
                : t('stock.movementQuantity')}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder={`${formData.type === 'adjustment' ? t('stock.newQuantity').toLowerCase() : t('stock.movementQuantity').toLowerCase()}`}
            />
          </div>

          {/* New Stock Preview */}
          {formData.quantity && (
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-sm text-blue-600">{t('stock.newStockLevel')}</p>
              <p className="text-xl font-bold text-blue-900">
                {getNewQuantity().toFixed(2)} {item.unit}
              </p>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('reports.reason')}
            </label>
            <input
              type="text"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder={t('stock.reasonPlaceholder')}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" className="flex-1">
              {t('confirm', { ns: 'common' })}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
