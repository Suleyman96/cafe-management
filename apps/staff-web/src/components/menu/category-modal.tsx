'use client';

import type { Database } from '@cafe-idare/database';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
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
  const isEditing = !!category;
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const [formData, setFormData] = useState({
    name_en: category?.name_en || '',
    description_en: category?.description_en || '',
    icon: category?.icon || '📁',
    display_order: category?.display_order?.toString() || '0',
    is_active: category?.is_active !== false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const toastId = toast.loading(isEditing ? 'Updating category...' : 'Creating category...');

    try {
      const categoryData = {
        ...formData,
        display_order: parseInt(formData.display_order, 10),
        // Add missing multilingual fields with defaults
        name_az: formData.name_en,
        name_ru: formData.name_en,
        name_tr: formData.name_en,
        description_az: formData.description_en,
        description_ru: formData.description_en,
        description_tr: formData.description_en,
      };

      if (isEditing) {
        await updateCategory.mutateAsync({
          id: category.id,
          updates: categoryData,
        });
        toast.success('Category updated successfully!', { id: toastId });
      } else {
        await createCategory.mutateAsync(categoryData);
        toast.success('Category created successfully!', { id: toastId });
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving category:', error);

      // Show user-friendly error message
      const errorMessage = error.message || 'Failed to save category';

      if (errorMessage.includes('infinite recursion') || errorMessage.includes('policy')) {
        toast.error('Database permission error. Please run the latest migration.', { id: toastId });
      } else if (errorMessage.includes('duplicate')) {
        toast.error('A category with this name already exists.', { id: toastId });
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
            {isEditing ? 'Edit Category' : 'Add Category'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Icon */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
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
              placeholder="Or enter custom emoji"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
            <input
              type="text"
              value={formData.name_en}
              onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Category name"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description_en}
              onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Category description"
            />
          </div>

          {/* Display Order and Active */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Display Order</label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {isEditing ? 'Update Category' : 'Create Category'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
