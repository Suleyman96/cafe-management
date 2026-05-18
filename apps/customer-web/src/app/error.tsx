'use client';

import { useTranslation } from '@gustri/i18n';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation('common');

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0C0C0E] px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
          <svg
            className="h-7 w-7 text-red-400"
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
        <h2 className="mb-2 text-lg font-semibold text-white">{t('error.title')}</h2>
        <p className="mb-6 text-sm text-white/55">{t('error.message')}</p>
        <button
          onClick={reset}
          className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/15 transition-colors"
        >
          {t('error.tryAgain')}
        </button>
      </div>
    </div>
  );
}
