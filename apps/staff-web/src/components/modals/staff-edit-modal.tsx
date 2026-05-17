'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/modals/confirm-dialog';
import { useStaffMember, useUpdateStaff } from '@/hooks';
import { supabase } from '@/lib/supabase/client';

type StaffRole = 'waiter' | 'admin' | 'kitchen' | 'owner';

import type { Staff } from '@/types';

interface StaffEditModalProps {
  staff: Staff;
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
  // List view fetches a narrow projection (no phone); pull the detail row so
  // the form initializes with the real phone value rather than blanking it.
  const { data: detail } = useStaffMember(staff.id);
  const [fullName, setFullName] = useState(staff.full_name || '');
  const [role, setRole] = useState<StaffRole>(staff.role || 'waiter');
  const [phone, setPhone] = useState('');
  const [phoneInitialized, setPhoneInitialized] = useState(false);
  const [isActive, setIsActive] = useState(staff.is_active ?? true);
  const [loading, setLoading] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const updateStaff = useUpdateStaff();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/v1/staff?id=${staff.id}`, {
        method: 'DELETE',
        headers: {
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || t('staffMgmt.failedDelete'));
        return;
      }

      toast.success(t('staffMgmt.staffDeleted'));
      onSuccess();
    } catch (_error) {
      toast.error(t('staffMgmt.failedDelete'));
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Sync state when staff prop changes
  useEffect(() => {
    setFullName(staff.full_name || '');
    setRole(staff.role || 'waiter');
    setIsActive(staff.is_active ?? true);
    setPhoneInitialized(false);
    setPhone('');
  }, [staff]);

  // Initialize phone once the detail fetch resolves (list view doesn't
  // include phone). Skip after first init so admin edits aren't clobbered.
  useEffect(() => {
    if (!phoneInitialized && detail) {
      setPhone(detail.phone || '');
      setPhoneInitialized(true);
    }
  }, [detail, phoneInitialized]);

  const isValid = fullName.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading || deleting) return;
    setLoading(true);

    try {
      const wasActive = staff.is_active ?? true;
      await updateStaff.mutateAsync({
        id: staff.id,
        updates: {
          full_name: fullName,
          role,
          phone: phone || null,
          is_active: isActive,
        },
      });

      // C3 — when admin flips `is_active: true → false`, revoke the
      // deactivated user's refresh tokens so their existing devices
      // can't keep refreshing access tokens until natural expiry. The
      // `is_active_staff` JWT claim already kicks them out within the
      // access-token TTL (~1 h) on the next refresh, but revoking here
      // forces re-authentication immediately on next refresh attempt
      // instead of waiting up to that window. A failure doesn't undo
      // the deactivation; the JWT-claim check still gates the user out
      // within ~1 h regardless.
      if (wasActive && !isActive) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          await fetch('/api/v1/staff/revoke-sessions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
            },
            body: JSON.stringify({ staffId: staff.id }),
          });
        } catch (_revokeError) {
          // Swallowed by design — the deactivation already landed; the
          // is_active_staff JWT check is the durable guarantee.
        }
      }

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
              <option value="waiter">{t('waiter', { ns: 'roles' })}</option>
              <option value="kitchen">{t('staffMgmt.kitchenStaff')}</option>
              <option value="admin">{t('admin', { ns: 'roles' })}</option>
              {currentUserRole === 'owner' && (
                <option value="owner">{t('owner', { ns: 'roles' })}</option>
              )}
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
              disabled={loading || deleting}
              className="flex-1"
            >
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" disabled={!isValid || loading || deleting} className="flex-1">
              {loading ? t('staffMgmt.saving') : t('saveChanges', { ns: 'common' })}
            </Button>
          </div>

          {staff.role !== 'owner' && (
            <div className="border-t pt-4">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading || deleting}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('staffMgmt.deleteStaff')}
              </Button>
            </div>
          )}
        </form>

        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          title={t('staffMgmt.deleteStaff')}
          message={t('staffMgmt.deleteStaffConfirm', { name: staff.full_name })}
          loading={deleting}
        />
      </div>
    </div>
  );
}
