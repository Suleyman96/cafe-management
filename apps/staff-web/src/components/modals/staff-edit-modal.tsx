'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useUpdateStaff } from '@/hooks';

type StaffRole = 'waiter' | 'admin' | 'kitchen' | 'owner';

interface StaffEditModalProps {
  staff: any;
  currentUserRole?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function StaffEditModal({
  staff,
  currentUserRole,
  onClose,
  onSuccess,
}: StaffEditModalProps) {
  const { t } = useTranslation('staff');
  const [fullName, setFullName] = useState(staff.full_name || '');
  const [role, setRole] = useState<StaffRole>(staff.role || 'waiter');
  const [phone, setPhone] = useState(staff.phone || '');
  const [isActive, setIsActive] = useState(staff.is_active ?? true);
  const [loading, setLoading] = useState(false);

  const updateStaff = useUpdateStaff();

  // Sync state when staff prop changes
  useEffect(() => {
    setFullName(staff.full_name || '');
    setRole(staff.role || 'waiter');
    setPhone(staff.phone || '');
    setIsActive(staff.is_active ?? true);
  }, [staff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateStaff.mutateAsync({
        id: staff.id,
        updates: {
          full_name: fullName,
          role,
          phone: phone || null,
          is_active: isActive,
        },
      });
      toast.success(t('staffMgmt.staffUpdated'));
      onSuccess();
    } catch (_error) {
      toast.error(t('staffMgmt.failedUpdate'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">{t('staffMgmt.editStaff')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('email', { ns: 'common' })}
            </label>
            <input
              type="email"
              value={staff.email}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">{t('staffMgmt.emailCannotChange')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('staffMgmt.fullName')} *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('staffMgmt.role')} *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="waiter">Waiter</option>
              <option value="kitchen">{t('staffMgmt.kitchenStaff')}</option>
              <option value="admin">Admin</option>
              {currentUserRole === 'owner' && <option value="owner">Owner</option>}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('phone', { ns: 'common' })}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              {t('staffMgmt.accountActive')}
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? t('staffMgmt.saving') : t('saveChanges', { ns: 'common' })}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
