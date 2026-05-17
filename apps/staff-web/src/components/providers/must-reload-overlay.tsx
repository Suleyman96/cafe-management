'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { subscribeClientMustReload } from '@/lib/client-outdated-state';

/**
 * Full-screen blocking overlay shown when the client has been on a stale
 * build for >2 min (Plan 11). Reads continue underneath; mutations are
 * blocked because the overlay covers the entire UI surface and no input
 * reaches the app until the user clicks Reload.
 *
 * Rendered unconditionally inside `ConnectionProvider`; visibility is
 * driven by the module-level `clientOutdatedState` singleton so non-React
 * code paths can also flip it without prop-drilling.
 */
export function MustReloadOverlay() {
  const { t } = useTranslation('staff');
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeClientMustReload(setVisible), []);

  if (!visible) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="must-reload-title"
      aria-describedby="must-reload-description"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="max-w-md w-full rounded-2xl bg-white shadow-2xl p-6 sm:p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <RefreshCw className="h-7 w-7 text-red-600" />
        </div>
        <h2 id="must-reload-title" className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
          {t('mustReload.title')}
        </h2>
        <p id="must-reload-description" className="text-sm sm:text-base text-gray-600 mb-6">
          {t('mustReload.description')}
        </p>
        <Button
          onClick={() => window.location.reload()}
          className="w-full bg-red-600 hover:bg-red-700 text-white text-base font-semibold py-3"
        >
          {t('mustReload.reload')}
        </Button>
      </div>
    </div>
  );
}
