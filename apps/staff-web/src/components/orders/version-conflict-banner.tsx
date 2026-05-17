'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import { AlertTriangle } from 'lucide-react';

/**
 * Refresh / Override banner rendered inside destructive-action modals
 * (close-unpaid, cancel-order) when the underlying mutation has thrown
 * `ConflictError('version_conflict')`.
 *
 * Plan 8 — for high-impact destructive actions the audit requires that
 * staff make an explicit choice rather than auto-recovering: either
 * **Refresh** (discard the in-flight action and read the fresh order so
 * the next attempt sees the latest totals/status) or **Override** (apply
 * the action regardless of staleness — server-side guards still police
 * the close-unpaid trigger and state-machine transitions, so this is
 * not a free pass; it only bypasses the `expectedVersion` check).
 */
export function VersionConflictBanner({
  onRefresh,
  onOverride,
  disabled,
}: {
  onRefresh: () => void;
  onOverride: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('staff');

  return (
    <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">{t('orders.versionConflict.title')}</p>
          <p className="text-xs text-amber-800 mt-1">{t('orders.versionConflict.body')}</p>
          <div className="flex gap-2 mt-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRefresh}
              disabled={disabled}
            >
              {t('orders.versionConflict.refresh')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={onOverride}
              disabled={disabled}
            >
              {t('orders.versionConflict.override')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
