import { useTranslation } from '@gustri/i18n';
import { Button, type ButtonProps } from 'react-native-paper';
import { useNetworkStatus } from '@/hooks/use-network-status';

type Props = ButtonProps & {
  /** Already-translated label rendered in place of children when offline.
   * Pass via `t('payment.offlineUnavailable')` from the screen's own
   * namespace so this component stays namespace-agnostic. */
  offlineLabel?: string;
};

/**
 * Submit button that disables itself when the device is offline (or behind a
 * captive portal — see use-network-status for the reachability gate).
 *
 * Use for mutations that must NEVER queue: payments, refunds, discounts,
 * settings updates, stock adjustments. Those hooks are configured with
 * `networkMode: 'always'` so they fail loudly online; this button is the
 * UX-side guard that keeps the user from triggering them while offline.
 */
export function OfflineGuardButton({ offlineLabel, children, ...props }: Props) {
  const { t } = useTranslation('common');
  const { isOnline } = useNetworkStatus();

  return (
    <Button
      {...props}
      disabled={!isOnline || props.disabled}
      accessibilityHint={!isOnline ? t('offline.actionUnavailable') : undefined}
    >
      {!isOnline && offlineLabel ? offlineLabel : children}
    </Button>
  );
}
