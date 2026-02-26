'use client';

import { useTranslation } from '@cafe-idare/i18n';
import { Button } from '@cafe-idare/ui';
import { useState } from 'react';
import { toast } from 'sonner';

interface StaffResetPasswordModalProps {
  staffId: string;
  staffName: string;
  onClose: () => void;
}

export function StaffResetPasswordModal({
  staffId,
  staffName,
  onClose,
}: StaffResetPasswordModalProps) {
  const { t } = useTranslation('staff');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError(t('staffMgmt.passwordMinLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('staffMgmt.passwordsDoNotMatch'));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/staff/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('staffMgmt.failedResetPassword'));
        return;
      }

      toast.success(t('staffMgmt.resetPasswordSuccess'));
      onClose();
    } catch (_err) {
      setError(t('staffMgmt.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-2">{t('staffMgmt.resetPassword')}</h2>
        <p className="text-sm text-gray-500 mb-4">
          {t('staffMgmt.setNewPasswordFor')} <strong>{staffName}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('staffMgmt.newPasswordFor')} *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('staffMgmt.minSixChars')}
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('staffMgmt.confirmPassword')} *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('staffMgmt.reenterPassword')}
              minLength={6}
              required
            />
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
              {loading ? t('staffMgmt.resetting') : t('staffMgmt.resetPassword')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
