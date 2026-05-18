'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import { RefreshCw, UtensilsCrossed } from 'lucide-react';

/**
 * H5 — explicit "table no longer active" surface for customer screens
 * downstream of `useTable`. Pre-H5 these screens did `table?.id || ''`
 * and the downstream `useOrder('')` was correctly disabled — but the
 * page rendered a stuck loading / empty state with no explanation.
 *
 * The actual reproducer is mundane: staff renames T05 → T05B mid-shift,
 * or deletes T07 because it was never set up. Every customer screen
 * pointing at the old `tableId` silently breaks. This component is the
 * recovery path.
 *
 * The CTA is a hard reload rather than a server-side waiter call,
 * because a deleted/renamed table has no valid UUID to attach a call
 * to. The body copy points the customer at the in-person path (flag a
 * waiter) which is the actual recovery in the kitchen-side sense.
 */
export function TableNotActiveScreen() {
  const { t } = useTranslation('customer');

  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="text-center mb-6 max-w-sm">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
          <UtensilsCrossed className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{t('tableNotActive.title')}</h1>
        <p className="text-muted-foreground">{t('tableNotActive.description')}</p>
      </div>
      <Button size="lg" className="w-full max-w-xs" onClick={handleReload}>
        <RefreshCw className="mr-2 h-5 w-5" />
        {t('tableNotActive.refresh')}
      </Button>
    </div>
  );
}
