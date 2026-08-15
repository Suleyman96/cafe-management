'use client';

import { useTranslation } from '@gustri/i18n';

export function CafeNotFound() {
  const { t } = useTranslation('auth');
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold text-gray-900">{t('cafeLogin.notFoundTitle')}</h1>
        <p className="mt-2 text-sm text-gray-500">{t('cafeLogin.notFoundBody')}</p>
      </div>
    </div>
  );
}
