'use client';

import { useTranslation } from '@gustri/i18n';
import { useFeatureFlag } from '@gustri/queries';
import { Button } from '@gustri/ui';
import { Lock, ShieldAlert } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { useCafeSettings } from '@/hooks/use-settings-safe';
import { supabase } from '@/lib/supabase/client';

// Plan 13 — soft-lock the staff-web tab after a configurable idle window
// (default 60 min, per cafe_settings.idle_soft_lock_minutes). The component
// listens for mousemove/keydown/touchstart and resets a single timer; when
// the timer fires, it mounts a full-screen backdrop with a PIN input.
//
// Why a timer per tab and not a shared one: leader election (Plan 9)
// already exists for audio, but the lock is intentionally per-tab — if the
// cashier is actively using one tab, only the idle tab should lock.
//
// Why "soft": the realtime subscriptions and React Query caches keep
// running underneath. The instant the staff member punches in their PIN
// the UI is current — they don't pay the price of a full page reload.

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'touchstart', 'pointerdown'] as const;
const DEFAULT_MINUTES = 60;
const FLAG_NAME = 'idle_soft_lock_pin';

export function IdleSoftLock({ children }: { children: React.ReactNode }) {
  const { staff } = useAuth();
  const { data: settings } = useCafeSettings();
  const enabled = useFeatureFlag(FLAG_NAME);

  // We only soft-lock if the staff member has a PIN set. Without one, the
  // backdrop would have no path forward — better to leave the tab usable
  // and let the staff member configure a PIN from settings on their own
  // schedule.
  const hasPin = !!staff?.pin_set_at;
  const minutes = settings?.idle_soft_lock_minutes ?? DEFAULT_MINUTES;
  const active = enabled && hasPin && minutes > 0;

  const [locked, setLocked] = useState(false);
  const lockMs = minutes * 60 * 1000;

  return (
    <>
      {children}
      {active && (
        <IdleWatcher
          lockMs={lockMs}
          locked={locked}
          onLock={() => setLocked(true)}
          onUnlock={() => setLocked(false)}
        />
      )}
    </>
  );
}

function IdleWatcher({
  lockMs,
  locked,
  onLock,
  onUnlock,
}: {
  lockMs: number;
  locked: boolean;
  onLock: () => void;
  onUnlock: () => void;
}) {
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  useEffect(() => {
    if (locked) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onLockRef.current(), lockMs);
    };

    reset();
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, reset, { passive: true });
    }
    // Reset on visibility change too — if a manager leaves the tab in the
    // background then comes back, we don't want to immediately challenge.
    const onVisible = () => {
      if (document.visibilityState === 'visible') reset();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (timer) clearTimeout(timer);
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, reset);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [lockMs, locked]);

  if (!locked) return null;
  return <PinPromptOverlay onSuccess={onUnlock} />;
}

function PinPromptOverlay({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation('staff');
  const { staff, logout } = useAuth();
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!pin || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          // Session expired while the tab sat idle — drop them at login.
          logout();
          return;
        }
        const res = await fetch('/api/v1/staff/verify-pin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ pin }),
        });
        if (res.ok) {
          setPin('');
          onSuccess();
          return;
        }
        if (res.status === 429) {
          setError(t('idleLock.tooManyAttempts'));
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (body.error === 'pin_not_set') {
          setError(t('idleLock.pinNotSet'));
          return;
        }
        setError(t('idleLock.incorrectPin'));
      } catch {
        setError(t('idleLock.verifyFailed'));
      } finally {
        setSubmitting(false);
      }
    },
    [pin, submitting, onSuccess, t, logout],
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/70 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-lock-title"
    >
      <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Lock className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 id="idle-lock-title" className="text-lg font-semibold text-gray-900">
              {t('idleLock.title')}
            </h2>
            <p className="text-xs text-gray-500">
              {staff ? t('idleLock.subtitle', { name: staff.full_name }) : t('idleLock.subtitle')}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="idle-lock-pin" className="block text-sm font-medium text-gray-700 mb-1">
              {t('idleLock.pinLabel')}
            </label>
            <input
              ref={inputRef}
              id="idle-lock-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, '').slice(0, 8));
                setError(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" disabled={submitting || pin.length < 4} className="w-full">
            {submitting ? t('idleLock.verifying') : t('idleLock.unlock')}
          </Button>

          <button
            type="button"
            onClick={() => {
              logout();
              toast.info(t('idleLock.signedOut'));
            }}
            className="w-full text-xs text-gray-500 hover:text-gray-700"
          >
            {t('idleLock.signOutInstead')}
          </button>
        </form>
      </div>
    </div>
  );
}
