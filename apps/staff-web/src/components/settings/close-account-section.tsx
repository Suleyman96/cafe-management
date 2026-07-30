'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useDeactivateTenant } from '@/hooks/use-deactivate-tenant';

// English-only, uppercase — the same keyword the server route requires. Not
// translated on purpose (a mistyped translated word is likelier than a
// deliberate confirmation; see the destructive-action notes in CLAUDE.md).
const CONFIRM_PHRASE = 'CLOSE';

/**
 * Owner-only "danger zone" for closing the whole account. Renders inline at the
 * bottom of cafe-settings; the caller gates it behind
 * `useCanPerform('close_account')` so it never shows for non-owners.
 */
export function CloseAccountSection() {
  const { t } = useTranslation('staff');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-10 rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
        <div className="flex-1">
          <h2 className="font-semibold text-red-900">{t('cafeSettings.dangerZone.title')}</h2>
          <p className="mt-1 text-sm text-red-800">
            {t('cafeSettings.dangerZone.closeAccountDesc')}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
            onClick={() => setIsOpen(true)}
          >
            {t('cafeSettings.dangerZone.closeAccountButton')}
          </Button>
        </div>
      </div>

      {isOpen && <CloseAccountModal onClose={() => setIsOpen(false)} />}
    </div>
  );
}

function CloseAccountModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('staff');
  const deactivate = useDeactivateTenant();
  const [reason, setReason] = useState('');
  const [phrase, setPhrase] = useState('');
  const titleId = useId();
  const phraseRef = useRef<HTMLInputElement>(null);
  const confirmed = phrase.trim() === CONFIRM_PHRASE;

  // Focus the gate input on open + close on Escape (unless a close is in flight).
  useEffect(() => {
    phraseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deactivate.isPending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, deactivate.isPending]);

  const handleConfirm = async () => {
    if (!confirmed) return;
    try {
      // On success the hook signs out + redirects; no navigation here.
      await deactivate.mutateAsync(reason.trim() || null);
    } catch {
      toast.error(t('cafeSettings.dangerZone.closeFailed'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 id={titleId} className="text-lg font-semibold text-gray-900">
              {t('cafeSettings.dangerZone.modalTitle')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deactivate.isPending}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label={t('cancel', { ns: 'common' })}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-sm text-gray-600">{t('cafeSettings.dangerZone.modalWarning')}</p>

        <label className="mt-4 block text-sm font-medium text-gray-700">
          {t('cafeSettings.dangerZone.reasonLabel')}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            disabled={deactivate.isPending}
            className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-red-400 focus:outline-none"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-gray-700">
          {t('cafeSettings.dangerZone.typeToConfirm', { phrase: CONFIRM_PHRASE })}
          <input
            ref={phraseRef}
            type="text"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            disabled={deactivate.isPending}
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-gray-300 p-2 font-mono text-sm focus:border-red-400 focus:outline-none"
          />
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={deactivate.isPending}>
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={handleConfirm}
            disabled={!confirmed || deactivate.isPending}
          >
            {deactivate.isPending
              ? t('cafeSettings.dangerZone.closing')
              : t('cafeSettings.dangerZone.confirmButton')}
          </Button>
        </div>
      </div>
    </div>
  );
}
