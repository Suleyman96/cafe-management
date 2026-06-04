'use client';

import { useTranslation } from '@gustri/i18n';
import {
  useCreateMenuItemOption,
  useCreateMenuItemOptionValue,
  useDeleteMenuItemOption,
  useDeleteMenuItemOptionValue,
  useMenuItemOptions,
} from '@gustri/queries';
import { Button, NumberInput } from '@gustri/ui-web';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/modals/confirm-dialog';
import { toastLocalizedError } from '@/lib/toast/localized-error';
import { useAuthStore } from '@/store/auth-store';

interface MenuItemModifiersModalProps {
  menuItemId: string;
  menuItemName: string;
  onClose: () => void;
}

type DeleteTarget = { kind: 'group' | 'value'; id: string } | null;

export function MenuItemModifiersModal({
  menuItemId,
  menuItemName,
  onClose,
}: MenuItemModifiersModalProps) {
  const { t } = useTranslation('staff');
  const tenantId = useAuthStore((s) => s.staff?.tenant_id);
  const { data: groups = [], isLoading } = useMenuItemOptions(menuItemId);

  const createGroup = useCreateMenuItemOption(menuItemId);
  const deleteGroup = useDeleteMenuItemOption(menuItemId);
  const createValue = useCreateMenuItemOptionValue(menuItemId);
  const deleteValue = useDeleteMenuItemOptionValue(menuItemId);

  // Add-group form
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectionType, setSelectionType] = useState<'single' | 'multi'>('single');
  const [isRequired, setIsRequired] = useState(false);

  // Per-group add-value form (only one open at a time)
  const [valueFormGroupId, setValueFormGroupId] = useState<string | null>(null);
  const [valueName, setValueName] = useState('');
  const [valuePrice, setValuePrice] = useState('0.00');

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const resetGroupForm = () => {
    setGroupName('');
    setSelectionType('single');
    setIsRequired(false);
    setShowGroupForm(false);
  };

  const resetValueForm = () => {
    setValueName('');
    setValuePrice('0.00');
    setValueFormGroupId(null);
  };

  const handleAddGroup = async () => {
    if (!groupName.trim() || !tenantId) return;
    try {
      await createGroup.mutateAsync({
        tenant_id: tenantId,
        menu_item_id: menuItemId,
        name: groupName.trim(),
        selection_type: selectionType,
        is_required: isRequired,
        // single = exactly one; required single implies min 1
        min_select: selectionType === 'single' && isRequired ? 1 : 0,
        max_select: selectionType === 'single' ? 1 : null,
        display_order: groups.length,
      });
      toast.success(t('menu.modifierGroupSaved'));
      resetGroupForm();
    } catch (error) {
      toastLocalizedError(error, t('menu.failedSaveModifier'));
    }
  };

  const handleAddValue = async (groupId: string) => {
    if (!valueName.trim() || !tenantId) return;
    const parsed = Number.parseFloat(valuePrice);
    try {
      await createValue.mutateAsync({
        tenant_id: tenantId,
        option_id: groupId,
        name: valueName.trim(),
        price_delta: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
        display_order: 0,
      });
      toast.success(t('menu.modifierOptionSaved'));
      resetValueForm();
    } catch (error) {
      toastLocalizedError(error, t('menu.failedSaveModifier'));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === 'group') {
        await deleteGroup.mutateAsync(deleteTarget.id);
        toast.success(t('menu.modifierGroupDeleted'));
      } else {
        await deleteValue.mutateAsync(deleteTarget.id);
        toast.success(t('menu.modifierOptionDeleted'));
      }
    } catch (error) {
      toastLocalizedError(error, t('menu.failedSaveModifier'));
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t('menu.modifiersTitle')}</h2>
            <p className="text-sm text-gray-500">{menuItemName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">{t('menu.modifiersIntro')}</p>

          {isLoading ? (
            <p className="text-sm text-gray-400">{t('loading', { ns: 'common' })}</p>
          ) : groups.length === 0 && !showGroupForm ? (
            <p className="text-sm text-gray-400">{t('menu.noModifierGroups')}</p>
          ) : null}

          {/* Groups */}
          {groups.map((group) => (
            <div key={group.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">{group.name}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {group.selection_type === 'single'
                      ? t('menu.selectionSingle')
                      : t('menu.selectionMulti')}
                    {group.is_required ? ` · ${t('required', { ns: 'common' })}` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteTarget({ kind: 'group', id: group.id })}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  {t('delete', { ns: 'common' })}
                </button>
              </div>

              {/* Values */}
              <ul className="mt-3 space-y-1">
                {group.values.map((value) => (
                  <li
                    key={value.id}
                    className="flex items-center justify-between text-sm text-gray-700"
                  >
                    <span>
                      {value.name}
                      {value.price_delta > 0 ? (
                        <span className="ml-2 text-gray-500">
                          +{Number(value.price_delta).toFixed(2)}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ kind: 'value', id: value.id })}
                      className="text-xs text-red-500 hover:text-red-600"
                    >
                      {t('delete', { ns: 'common' })}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Add value */}
              {valueFormGroupId === group.id ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={valueName}
                    onChange={(e) => setValueName(e.target.value)}
                    placeholder={t('menu.optionValueNamePlaceholder')}
                    className="flex-1 min-w-[8rem] px-3 py-1.5 border border-gray-300 rounded text-sm"
                  />
                  <div className="w-28">
                    <NumberInput
                      value={valuePrice}
                      onChange={setValuePrice}
                      min={0}
                      placeholder="0.00"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleAddValue(group.id)}
                    disabled={!valueName.trim() || createValue.isPending}
                  >
                    {t('add', { ns: 'common' })}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetValueForm}>
                    {t('cancel', { ns: 'common' })}
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    resetValueForm();
                    setValueFormGroupId(group.id);
                  }}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700"
                >
                  + {t('menu.addOption')}
                </button>
              )}
            </div>
          ))}

          {/* Add group */}
          {showGroupForm ? (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={t('menu.optionGroupNamePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">{t('menu.selectionType')}</span>
                  <select
                    value={selectionType}
                    onChange={(e) => setSelectionType(e.target.value as 'single' | 'multi')}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="single">{t('menu.selectionSingle')}</option>
                    <option value="multi">{t('menu.selectionMulti')}</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-700">{t('required', { ns: 'common' })}</span>
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleAddGroup}
                  disabled={!groupName.trim() || createGroup.isPending}
                >
                  {t('save', { ns: 'common' })}
                </Button>
                <Button type="button" variant="outline" onClick={resetGroupForm}>
                  {t('cancel', { ns: 'common' })}
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => setShowGroupForm(true)}>
              + {t('menu.addOptionGroup')}
            </Button>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end">
          <Button type="button" onClick={onClose}>
            {t('close', { ns: 'common' })}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={
          deleteTarget?.kind === 'group' ? t('menu.deleteGroupTitle') : t('menu.deleteValueTitle')
        }
        message={
          deleteTarget?.kind === 'group'
            ? t('menu.deleteGroupMessage')
            : t('menu.deleteValueMessage')
        }
        loading={deleteGroup.isPending || deleteValue.isPending}
      />
    </div>
  );
}
