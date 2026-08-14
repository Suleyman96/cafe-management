'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import { useMutation } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiRoutes, type PlatformTenant } from '@/lib/api-routes';

const PLANS: PlatformTenant['plan'][] = ['free', 'standard', 'pro', 'business'];

function randomPassword(): string {
  // Readable-ish, 14 chars from a no-ambiguous alphabet. Not security-critical
  // (operator shares it, owner can reset later) — just needs to pass the min-8.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function CreateTenantModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation('staff');
  const titleId = useId();
  const firstRef = useRef<HTMLInputElement>(null);

  const [cafeName, setCafeName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState<PlatformTenant['plan']>('free');

  const create = useMutation({
    mutationFn: () =>
      apiRoutes.platform.createTenant({
        cafe_name: cafeName.trim(),
        owner_email: ownerEmail.trim(),
        owner_name: ownerName.trim() || null,
        password,
        plan,
      }),
    onSuccess: () => {
      toast.success(t('platformCreate.created'));
      onCreated();
      onClose();
    },
    onError: (err: Error) => {
      toast.error(
        err.message.includes('email_in_use')
          ? t('platformCreate.emailInUse')
          : t('platform.actionFailed'),
      );
    },
  });

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !create.isPending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, create.isPending]);

  const valid =
    cafeName.trim().length > 0 && /.+@.+\..+/.test(ownerEmail.trim()) && password.length >= 8;

  const inputCls =
    'mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-primary-400 focus:outline-none disabled:opacity-50';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h3 id={titleId} className="text-lg font-semibold text-gray-900">
            {t('platformCreate.title')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={create.isPending}
            aria-label={t('cancel', { ns: 'common' })}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500">{t('platformCreate.subtitle')}</p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            {t('platformCreate.cafeName')}
            <input
              ref={firstRef}
              value={cafeName}
              onChange={(e) => setCafeName(e.target.value)}
              disabled={create.isPending}
              maxLength={100}
              className={inputCls}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            {t('platformCreate.ownerEmail')}
            <input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              disabled={create.isPending}
              autoComplete="off"
              className={inputCls}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            {t('platformCreate.ownerName')}
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              disabled={create.isPending}
              maxLength={100}
              className={inputCls}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            {t('platformCreate.password')}
            <div className="mt-1 flex gap-2">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={create.isPending}
                autoComplete="off"
                className="w-full rounded-lg border border-gray-300 p-2 font-mono text-sm focus:border-primary-400 focus:outline-none disabled:opacity-50"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={create.isPending}
                onClick={() => setPassword(randomPassword())}
              >
                {t('platformCreate.generate')}
              </Button>
            </div>
            <span className="mt-1 block text-xs text-gray-400">
              {t('platformCreate.passwordHint')}
            </span>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            {t('platform.plan')}
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as PlatformTenant['plan'])}
              disabled={create.isPending}
              className={inputCls}
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {t(`platform.plan_${p}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button onClick={() => create.mutate()} disabled={!valid || create.isPending}>
            {create.isPending ? t('platformCreate.creating') : t('platformCreate.create')}
          </Button>
        </div>
      </div>
    </div>
  );
}
