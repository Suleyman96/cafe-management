'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/modals/confirm-dialog';
import {
  useCreateExpenseCategory,
  useDeleteExpenseCategory,
  useExpenseCategories,
  useUpdateExpenseCategory,
} from '@/hooks';
import { toastLocalizedError } from '@/lib/toast/localized-error';

interface ExpenseCategoryModalProps {
  onClose: () => void;
}

export function ExpenseCategoryModal({ onClose }: ExpenseCategoryModalProps) {
  const { t } = useTranslation('staff');
  const { data: categories = [], isLoading } = useExpenseCategories();
  const createCategory = useCreateExpenseCategory();
  const updateCategory = useUpdateExpenseCategory();
  const deleteCategory = useDeleteExpenseCategory();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', icon: '' });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({ name: '', description: '', icon: '' });
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      toast.error(t('expenses.nameRequired'));
      return;
    }

    try {
      await createCategory.mutateAsync({
        name: formData.name,
        description: formData.description || null,
        icon: formData.icon || null,
        is_active: true,
      });
      toast.success(t('expenses.categoryCreated'));
      resetForm();
    } catch (error: unknown) {
      toastLocalizedError(error, t('expenses.failedCreateCategory'));
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
      toast.success(t('expenses.categoryUpdated'));
      resetForm();
    } catch (error: unknown) {
      toastLocalizedError(error, t('expenses.failedUpdateCategory'));
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    try {
      await deleteCategory.mutateAsync(deletingId);
      toast.success(t('expenses.categoryDeleted'));
      setDeletingId(null);
    } catch (error: unknown) {
      toastLocalizedError(error, t('expenses.failedDeleteCategory'));
    }
  };

  const startEdit = (cat: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
  }) => {
    setEditingId(cat.id);
    setFormData({ name: cat.name, description: cat.description || '', icon: cat.icon || '' });
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{t('expenses.expenseCategories')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            &times;
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Category List */}
          {isLoading ? (
            <p className="text-gray-500 text-center py-4">{t('loading', { ns: 'common' })}...</p>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
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
                        placeholder={t('expenses.categoryName')}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdate}>
                          {t('save', { ns: 'common' })}
                        </Button>
                        <Button size="sm" variant="outline" onClick={resetForm}>
                          {t('cancel', { ns: 'common' })}
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
                          onClick={() => setDeletingId(cat.id)}
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
                <p className="text-gray-500 text-center py-4">{t('expenses.noCategories')}</p>
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
                placeholder={t('expenses.categoryName')}
              />
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder={`${t('description', { ns: 'common' })} (${t('optional', { ns: 'common' }).toLowerCase()})`}
              />
              <div className="flex gap-2">
                <Button onClick={handleAdd} className="flex-1">
                  {t('expenses.addCategory')}
                </Button>
                <Button variant="outline" onClick={resetForm} className="flex-1">
                  {t('cancel', { ns: 'common' })}
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
              {t('expenses.addCategory')}
            </button>
          )}
        </div>

        {/* Close */}
        <div className="border-t px-6 py-4">
          <Button variant="outline" onClick={onClose} className="w-full">
            {t('expenses.done')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title={t('expenses.deleteCategory')}
        message={t('expenses.deleteCategoryConfirm')}
        loading={deleteCategory.isPending}
      />
    </div>
  );
}
