'use client';

import { useTranslation } from '@gustri/i18n';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function StaffError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation('common');
  const [eventId, setEventId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Capture and keep the resulting Sentry event id so support / dev
    // can grep it directly in Sentry. Without this, prod users have no
    // way to reference the specific crash they hit — they only see the
    // generic toast and "An error occurred" page, and the only link
    // back to the underlying stack is server-time correlation (slow
    // and lossy). The displayed id is also a fingerprint we can ask the
    // user to share in support.
    const id = Sentry.captureException(error);
    setEventId(id);
  }, [error]);

  // Compact identifier the user can quote: prefer Next's request digest
  // (server-set, surfaces in vercel logs too) and fall back to the
  // Sentry event id. Both are useful — we show whichever is shorter.
  const diagnosticCode = error.digest ?? eventId;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-7 w-7 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">{t('error.title')}</h2>
        <p className="mb-4 text-sm text-gray-500">{t('error.pageMessage')}</p>

        {diagnosticCode && (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(diagnosticCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                // Clipboard blocked (older browsers, insecure context) —
                // show the value selected so the user can copy manually.
              }
            }}
            className="mb-6 inline-flex items-center gap-2 rounded-md bg-gray-50 px-3 py-1.5 text-xs font-mono text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
            title={t('error.copyDiagnostic', { defaultValue: 'Copy diagnostic code' })}
          >
            <span>{copied ? '✓' : '⧉'}</span>
            <span className="select-all">{diagnosticCode}</span>
          </button>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            {t('error.tryAgain')}
          </button>
          <Link
            href="/tables"
            className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {t('error.goToDashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
