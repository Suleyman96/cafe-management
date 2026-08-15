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
  const handoffRef = useRef<HTMLHeadingElement>(null);

  const [cafeName, setCafeName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState<PlatformTenant['plan']>('free');
  // Set after a successful create → switches the modal to the handoff panel
  // (login link + credentials to send the new owner).
  const [created, setCreated] = useState<{ slug: string; email: string; password: string } | null>(
    null,
  );

  const create = useMutation({
    mutationFn: () =>
      apiRoutes.platform.createTenant({
        cafe_name: cafeName.trim(),
        owner_email: ownerEmail.trim(),
        owner_name: ownerName.trim() || null,
        password,
        plan,
      }),
    onSuccess: (res) => {
      toast.success(t('platformCreate.created'));
      onCreated();
      setCreated({ slug: res.tenant.slug, email: ownerEmail.trim(), password });
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !create.isPending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, create.isPending]);

  // Move focus into whichever view is showing: the form's first field, or the
  // handoff panel's heading once created. Without this, switching to the handoff
  // panel drops focus to <body> (the focused Create button unmounts).
  useEffect(() => {
    if (created) handoffRef.current?.focus();
    else firstRef.current?.focus();
  }, [created]);

  const valid =
    cafeName.trim().length > 0 && /.+@.+\..+/.test(ownerEmail.trim()) && password.length >= 8;

  const inputCls =
    'mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-primary-400 focus:outline-none disabled:opacity-50';

  // Handoff panel — what the operator sends the new owner.
  if (created) {
    const loginUrl = `${window.location.origin}/c/${created.slug}`;
    const rows: [string, string][] = [
      [t('platformCreate.loginLink'), loginUrl],
      [t('platformCreate.ownerEmail'), created.email],
      [t('platformCreate.password'), created.password],
    ];
    const copyAll = () => {
      // This copy carries the plaintext password — a silent failure would leave
      // the operator pasting stale clipboard content to the new owner. Handle
      // rejection (permission denied / non-secure context) explicitly.
      navigator.clipboard.writeText(rows.map(([k, v]) => `${k}: ${v}`).join('\n')).then(
        () => toast.success(t('platformCreate.copied')),
        () => toast.error(t('platform.actionFailed')),
      );
    };
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <h3
            id={titleId}
            ref={handoffRef}
            tabIndex={-1}
            className="text-lg font-semibold text-gray-900 focus:outline-none"
          >
            {t('platformCreate.created')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">{t('platformCreate.handoffHint')}</p>
          <div className="mt-4 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            {rows.map(([label, value]) => (
              <div key={label}>
                <div className="text-xs uppercase text-gray-400">{label}</div>
                <div className="break-all font-mono text-gray-800">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={copyAll}>
              {t('platformCreate.copyAll')}
            </Button>
            <Button onClick={onClose}>{t('platformCreate.done')}</Button>
          </div>
        </div>
      </div>
    );
  }

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
