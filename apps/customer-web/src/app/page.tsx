'use client';

import { useTranslation } from '@gustri/i18n';

export default function HomePage() {
  const { t } = useTranslation('customer');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="mb-6 text-6xl">📱</div>
      <h1 className="mb-2 text-xl font-semibold text-gray-900">{t('table.hintScanQR')}</h1>
      <p className="text-sm text-gray-500">{t('table.invalidDescription')}</p>
    </div>
  );
}
