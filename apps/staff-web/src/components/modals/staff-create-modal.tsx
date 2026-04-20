'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';

type StaffRole = 'waiter' | 'admin' | 'kitchen' | 'owner';

interface StaffCreateModalProps {
  currentUserRole?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function StaffCreateModal({ currentUserRole, onClose, onSuccess }: StaffCreateModalProps) {
  const { t } = useTranslation('staff');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<StaffRole>('waiter');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          role,
          phone: phone || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('staffMgmt.failedCreate'));
        return;
      }

      toast.success(t('staffMgmt.staffCreated'));
      onSuccess();
    } catch (_err) {
      setError(t('staffMgmt.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">{t('staffMgmt.addNewStaff')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('staffMgmt.fullName')} *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('email', { ns: 'common' })} *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="staff@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('staffMgmt.password')} *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('staffMgmt.minSixChars')}
              minLength={6}
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
              placeholder={t('phonePlaceholder', { ns: 'common' })}
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
              {loading ? t('staffMgmt.creating') : t('staffMgmt.createAccount')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
