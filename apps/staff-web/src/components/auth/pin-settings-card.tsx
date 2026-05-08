'use client';

import { useTranslation } from '@gustri/i18n';
import { useFeatureFlag } from '@gustri/queries';
import { Button } from '@gustri/ui';
import { KeyRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase/client';
import { db } from '@/lib/supabase/wrapped-client';
import { useAuthStore } from '@/store/auth-store';

// Plan 13 — staff self-service for the soft-lock PIN. Visible only when the
// idle_soft_lock_pin feature flag is on for the tenant; the rollout plan
// keeps it dark for tenants that haven't opted in.

export function PinSettingsCard() {
  const { t } = useTranslation('staff');
  const { staff } = useAuth();
  const setStaff = useAuthStore((s) => s.setStaff);
  const enabled = useFeatureFlag('idle_soft_lock_pin');

  const hasPin = !!staff?.pin_set_at;
  const [editing, setEditing] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!enabled) return null;

  const reset = () => {
    setEditing(false);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
  };

  // Pull fresh staff data so pin_set_at flips immediately after a save.
  // The auth store is the source of truth for the soft-lock gate; the
  // STAFF_DETAIL_SELECT projection now includes pin_set_at (pin_hash stays
  // server-only).
  const refreshStaff = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const fresh = await db.staff.findByAuthId(user.id);
      if (fresh) setStaff(fresh);
    } catch {
      // Non-fatal — the next sign-in cycle will pick up the new value.
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(newPin)) {
      toast.error(t('idleLock.invalidPinFormat'));
      return;
    }
    if (newPin !== confirmPin) {
      toast.error(t('idleLock.pinsDoNotMatch'));
      return;
    }
    if (hasPin && !/^\d{4,8}$/.test(currentPin)) {
      toast.error(t('idleLock.currentPinRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/v1/staff/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ newPin, currentPin: hasPin ? currentPin : undefined }),
      });
      if (res.ok) {
        toast.success(t('idleLock.pinSaved'));
        // Refresh the cached staff row so pin_set_at reflects the new state.
        await refreshStaff();
        reset();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (body.error === 'current_pin_invalid') {
        toast.error(t('idleLock.currentPinInvalid'));
      } else if (body.error === 'current_pin_required') {
        toast.error(t('idleLock.currentPinRequired'));
      } else {
        toast.error(t('idleLock.saveFailed'));
      }
    } catch {
      toast.error(t('idleLock.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const clear = async () => {
    if (!hasPin) return;
    if (!/^\d{4,8}$/.test(currentPin)) {
      toast.error(t('idleLock.currentPinRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/v1/staff/pin', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ currentPin }),
      });
      if (res.ok) {
        toast.success(t('idleLock.pinCleared'));
        await refreshStaff();
        reset();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (body.error === 'current_pin_invalid') {
        toast.error(t('idleLock.currentPinInvalid'));
      } else {
        toast.error(t('idleLock.saveFailed'));
      }
    } catch {
      toast.error(t('idleLock.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
          <h2 className="text-base sm:text-lg font-semibold">{t('idleLock.cardTitle')}</h2>
        </div>
        {!editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            className="text-xs sm:text-sm w-full sm:w-auto"
          >
            {hasPin ? t('idleLock.changePin') : t('idleLock.setPin')}
          </Button>
        )}
      </div>

      {!editing ? (
        <p className="text-xs sm:text-sm text-gray-500">
          {hasPin ? t('idleLock.pinSetDescription') : t('idleLock.cardDescription')}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {hasPin && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                {t('idleLock.currentPin')}
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                maxLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                disabled={submitting}
              />
            </div>
          )}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              {t('idleLock.newPin')}
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              maxLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder={t('idleLock.pinPlaceholder')}
              disabled={submitting}
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              {t('idleLock.confirmPin')}
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              maxLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              disabled={submitting}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting} size="sm" className="flex-1 sm:flex-none">
              {submitting ? t('saving', { ns: 'common' }) : t('idleLock.save')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reset}
              disabled={submitting}
              className="flex-1 sm:flex-none"
            >
              {t('cancel', { ns: 'common' })}
            </Button>
            {hasPin && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clear}
                disabled={submitting}
                className="text-red-600"
              >
                {t('idleLock.clearPin')}
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
