'use client';

import type { Database } from '@cafe-idare/database';
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
  const isEditing = !!item;
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();

  const [formData, setFormData] = useState({
    category_id: item?.category_id || '',
    name_en: item?.name_en || '',
    description_en: item?.description_en || '',
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
        ? 'Uploading image...'
        : isEditing
          ? 'Updating menu item...'
          : 'Creating menu item...',
    );

    try {
      let imageUrl = item?.image_url;

      // Upload image if selected
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `menu-items/${fileName}`;

        toast.loading('Uploading image...', { id: toastId });

        const { error: uploadError } = await supabase.storage
          .from('menu-images')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('menu-images').getPublicUrl(filePath);

        imageUrl = data.publicUrl;
        toast.loading(isEditing ? 'Updating menu item...' : 'Creating menu item...', {
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
        // Add missing multilingual fields with defaults
        name_az: formData.name_en,
        name_ru: formData.name_en,
        name_tr: formData.name_en,
        description_az: formData.description_en,
        description_ru: formData.description_en,
        description_tr: formData.description_en,
      };

      if (isEditing) {
        await updateItem.mutateAsync({
          id: item.id,
          updates: itemData,
        });
        toast.success('Menu item updated successfully!', { id: toastId });
      } else {
        await createItem.mutateAsync(itemData);
        toast.success('Menu item created successfully!', { id: toastId });
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving menu item:', error);

      const errorMessage = error.message || 'Failed to save menu item';

      if (errorMessage.includes('infinite recursion') || errorMessage.includes('policy')) {
        toast.error('Database permission error. Please run the latest migration.', { id: toastId });
      } else if (errorMessage.includes('storage')) {
        toast.error('Failed to upload image. Please try again.', { id: toastId });
      } else if (errorMessage.includes('duplicate')) {
        toast.error('A menu item with this name already exists.', { id: toastId });
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
            {isEditing ? 'Edit Menu Item' : 'Add Menu Item'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name_en}
                </option>
              ))}
            </select>
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
              placeholder="Item name (e.g., Cappuccino, Caesar Salad)"
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
              placeholder="Item description"
            />
          </div>

          {/* Price and Preparation Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price * (USD)</label>
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
                Preparation Time (minutes)
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Image</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Options</label>
            <div className="flex flex-wrap gap-3">
              {[
                { key: 'is_vegetarian', label: '🌱 Vegetarian' },
                { key: 'is_vegan', label: '🌿 Vegan' },
                { key: 'is_gluten_free', label: '🌾 Gluten Free' },
                { key: 'is_spicy', label: '🌶️ Spicy' },
                { key: 'is_popular', label: '⭐ Popular' },
                { key: 'is_daily_special', label: '🎯 Daily Special' },
              ].map((option) => (
                <label key={option.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData[option.key as keyof typeof formData] as boolean}
                    onChange={(e) => setFormData({ ...formData, [option.key]: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Allergens */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Allergens</label>
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
                  checked={formData.is_available}
                  onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Available</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={uploading} className="flex-1">
              {uploading ? 'Saving...' : isEditing ? 'Update Item' : 'Create Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
