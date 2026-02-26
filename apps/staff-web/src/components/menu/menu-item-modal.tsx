'use client';

import type { Database } from '@cafe-idare/database';
import { useTranslation } from '@cafe-idare/i18n';
import { Button } from '@cafe-idare/ui';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useCreateMenuItem, useUpdateMenuItem } from '@/hooks';
import { supabase } from '@/lib/supabase/client';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

interface MenuItemModalProps {
  item?: MenuItem;
  categories: Category[];
  onClose: () => void;
}

const COMMON_ALLERGENS = ['Gluten', 'Dairy', 'Eggs', 'Nuts', 'Soy', 'Fish', 'Shellfish', 'Sesame'];

export function MenuItemModal({ item, categories, onClose }: MenuItemModalProps) {
  const { t } = useTranslation('staff');
  const isEditing = !!item;
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();

  const [formData, setFormData] = useState({
    category_id: item?.category_id || '',
    name: item?.name || '',
    description: item?.description || '',
    price: item?.price?.toString() || '0.00',
    preparation_time: item?.preparation_time?.toString() || '',
    is_popular: item?.is_popular || false,
    is_vegetarian: item?.is_vegetarian || false,
    is_vegan: item?.is_vegan || false,
    is_gluten_free: item?.is_gluten_free || false,
    is_spicy: item?.is_spicy || false,
    allergens: item?.allergens || [],
    is_available: item?.is_available !== false,
    is_daily_special: item?.is_daily_special || false,
    display_order: item?.display_order?.toString() || '0',
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(item?.image_url || null);
  const [uploading, setUploading] = useState(false);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>(
    formData.allergens as string[],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    const toastId = toast.loading(
      imageFile
        ? t('menu.uploadingImage')
        : isEditing
          ? t('menu.updatingMenuItem')
          : t('menu.creatingMenuItem'),
    );

    try {
      let imageUrl = item?.image_url;

      // Upload image if selected
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `menu-items/${fileName}`;

        toast.loading(t('menu.uploadingImage'), { id: toastId });

        const { error: uploadError } = await supabase.storage
          .from('menu-images')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('menu-images').getPublicUrl(filePath);

        imageUrl = data.publicUrl;
        toast.loading(isEditing ? t('menu.updatingMenuItem') : t('menu.creatingMenuItem'), {
          id: toastId,
        });
      }

      const itemData = {
        ...formData,
        price: parseFloat(formData.price),
        preparation_time: formData.preparation_time
          ? parseInt(formData.preparation_time, 10)
          : null,
        display_order: parseInt(formData.display_order, 10),
        allergens: selectedAllergens.length > 0 ? selectedAllergens : null,
        category_id: formData.category_id || null,
        image_url: imageUrl || null,
      };

      if (isEditing) {
        await updateItem.mutateAsync({
          id: item.id,
          updates: itemData,
        });
        toast.success(t('menu.itemUpdatedSuccess'), { id: toastId });
      } else {
        await createItem.mutateAsync(itemData);
        toast.success(t('menu.itemCreatedSuccess'), { id: toastId });
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving menu item:', error);

      const errorMessage = error.message || 'Failed to save menu item';

      if (errorMessage.includes('infinite recursion') || errorMessage.includes('policy')) {
        toast.error(t('menu.dbPermissionError'), { id: toastId });
      } else if (errorMessage.includes('storage')) {
        toast.error(t('menu.imageUploadFailed'), { id: toastId });
      } else if (errorMessage.includes('duplicate')) {
        toast.error(t('menu.duplicateItem'), { id: toastId });
      } else {
        toast.error(errorMessage, { id: toastId });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleAllergen = (allergen: string) => {
    setSelectedAllergens((prev) =>
      prev.includes(allergen) ? prev.filter((a) => a !== allergen) : [...prev, allergen],
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? t('menu.editMenuItem') : t('menu.addMenuItem')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('category', { ns: 'common' })}
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('menu.noCategory')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
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
              placeholder={t('menu.itemNamePlaceholder')}
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
              placeholder={t('menu.itemDescriptionPlaceholder')}
            />
          </div>

          {/* Price and Preparation Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('menu.priceLabel')} *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('menu.preparationTimeMinutes')}
              </label>
              <input
                type="number"
                min="0"
                value={formData.preparation_time}
                onChange={(e) => setFormData({ ...formData, preparation_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('menu.image')}
            </label>
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="w-32 h-32 object-cover rounded-lg mb-2"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Dietary Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('menu.dietaryOptions')}
            </label>
            <div className="flex flex-wrap gap-3">
              {[
                { key: 'is_vegetarian', icon: '🌱', labelKey: 'menu.vegetarian' },
                { key: 'is_vegan', icon: '🌿', labelKey: 'menu.vegan' },
                { key: 'is_gluten_free', icon: '🌾', labelKey: 'menu.glutenFree' },
                { key: 'is_spicy', icon: '🌶️', labelKey: 'menu.spicy' },
                { key: 'is_popular', icon: '⭐', labelKey: 'menu.popular' },
                { key: 'is_daily_special', icon: '🎯', labelKey: 'menu.dailySpecial' },
              ].map((option) => (
                <label key={option.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData[option.key as keyof typeof formData] as boolean}
                    onChange={(e) => setFormData({ ...formData, [option.key]: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    {option.icon} {t(option.labelKey)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Allergens */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('menu.allergens')}
            </label>
            <div className="flex flex-wrap gap-2">
              {COMMON_ALLERGENS.map((allergen) => (
                <button
                  key={allergen}
                  type="button"
                  onClick={() => toggleAllergen(allergen)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedAllergens.includes(allergen)
                      ? 'bg-red-100 text-red-800 border border-red-300'
                      : 'bg-gray-100 text-gray-700 border border-gray-300'
                  }`}
                >
                  {allergen}
                </button>
              ))}
            </div>
          </div>

          {/* Other Options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('menu.displayOrder')}
              </label>
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
                  checked={formData.is_available}
                  onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">{t('menu.available')}</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" disabled={uploading} className="flex-1">
              {uploading
                ? t('staffMgmt.saving')
                : isEditing
                  ? t('menu.updateItem')
                  : t('menu.createItem')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
