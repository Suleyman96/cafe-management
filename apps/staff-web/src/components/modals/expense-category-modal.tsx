'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import {
  useCreateExpenseCategory,
  useDeleteExpenseCategory,
  useExpenseCategories,
  useUpdateExpenseCategory,
} from '@/hooks';

interface ExpenseCategoryModalProps {
  onClose: () => void;
}

export function ExpenseCategoryModal({ onClose }: ExpenseCategoryModalProps) {
  const { data: categories = [], isLoading } = useExpenseCategories();
  const createCategory = useCreateExpenseCategory();
  const updateCategory = useUpdateExpenseCategory();
  const deleteCategory = useDeleteExpenseCategory();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', icon: '' });

  const resetForm = () => {
    setFormData({ name: '', description: '', icon: '' });
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      await createCategory.mutateAsync({
        name: formData.name,
        description: formData.description || null,
        icon: formData.icon || null,
        is_active: true,
      });
      toast.success('Category created!');
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create category');
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !formData.name.trim()) return;

    try {
      await updateCategory.mutateAsync({
        id: editingId,
        updates: {
          name: formData.name,
          description: formData.description || null,
          icon: formData.icon || null,
        },
      });
      toast.success('Category updated!');
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update category');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category? Expenses will keep their data but show no category.')) {
      return;
    }

    try {
      await deleteCategory.mutateAsync(id);
      toast.success('Category deleted!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete category');
    }
  };

  const startEdit = (cat: any) => {
    setEditingId(cat.id);
    setFormData({ name: cat.name, description: cat.description || '', icon: cat.icon || '' });
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Expense Categories</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            &times;
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Category List */}
          {isLoading ? (
            <p className="text-gray-500 text-center py-4">Loading...</p>
          ) : (
            <div className="space-y-2">
              {categories.map((cat: any) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  {editingId === cat.id ? (
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Category name"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdate}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={resetForm}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-gray-900">{cat.name}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEdit(cat)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cat.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-gray-500 text-center py-4">No categories yet</p>
              )}
            </div>
          )}

          {/* Add Form */}
          {showAddForm ? (
            <div className="border-t pt-4 space-y-3">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Category name"
              />
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Description (optional)"
              />
              <div className="flex gap-2">
                <Button onClick={handleAdd} className="flex-1">
                  Add Category
                </Button>
                <Button variant="outline" onClick={resetForm} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
              className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Category
            </button>
          )}
        </div>

        {/* Close */}
        <div className="border-t px-6 py-4">
          <Button variant="outline" onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
