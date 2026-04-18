'use client';

import type { Database } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { Button, NumberInput } from '@gustri/ui';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCreateCategory, useUpdateCategory } from '@/hooks';

type Category = Database['public']['Tables']['categories']['Row'];

interface CategoryModalProps {
  category?: Category;
  onClose: () => void;
}

const COMMON_ICONS = [
  '📁',
  '☕',
  '🍔',
  '🍕',
  '🍝',
  '🥗',
  '🍰',
  '🥤',
  '🍺',
  '🍷',
  '🍽️',
  '🥐',
  '🍳',
  '🥙',
  '🌮',
];

export function CategoryModal({ category, onClose }: CategoryModalProps) {
  const { t } = useTranslation('staff');
  const isEditing = !!category;
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const [formData, setFormData] = useState({
    name: category?.name || '',
    description: category?.description || '',
    icon: category?.icon || '📁',
    display_order: category?.display_order?.toString() || '0',
    is_active: category?.is_active !== false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const toastId = toast.loading(
      isEditing ? t('menu.updatingCategory') : t('menu.creatingCategory'),
    );

    try {
      const categoryData = {
        ...formData,
        display_order: parseInt(formData.display_order, 10),
      };

      if (isEditing) {
        await updateCategory.mutateAsync({
          id: category.id,
          updates: categoryData,
        });
        toast.success(t('menu.categoryUpdatedSuccess'), { id: toastId });
      } else {
        await createCategory.mutateAsync(categoryData);
        toast.success(t('menu.categoryCreatedSuccess'), { id: toastId });
      }

      onClose();
    } catch (error: unknown) {
      console.error('Error saving category:', error);

      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : t('menu.failedSaveCategory');

      if (errorMessage.includes('infinite recursion') || errorMessage.includes('policy')) {
        toast.error(t('menu.dbPermissionError'), { id: toastId });
      } else if (errorMessage.includes('duplicate')) {
        toast.error(t('menu.duplicateCategory'), { id: toastId });
      } else {
        toast.error(errorMessage, { id: toastId });
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? t('menu.editCategory') : t('menu.addCategory')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Icon */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('menu.icon')}</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {COMMON_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormData({ ...formData, icon })}
                  className={`text-2xl p-2 rounded border ${
                    formData.icon === icon
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder={t('menu.customEmoji')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

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
              placeholder={t('menu.categoryNamePlaceholder')}
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
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder={t('menu.categoryDescriptionPlaceholder')}
            />
          </div>

          {/* Display Order and Active */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('menu.displayOrder')}
              </label>
              <NumberInput
                value={formData.display_order}
                onChange={(v) => setFormData({ ...formData, display_order: v })}
                min={0}
                integer
                placeholder="0"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  {t('active', { ns: 'common' })}
                </span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" className="flex-1">
              {isEditing ? t('menu.updateCategory') : t('menu.createCategory')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
