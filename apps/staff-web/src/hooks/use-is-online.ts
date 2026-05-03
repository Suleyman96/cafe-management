import { useConnectionStatus } from '@/components/providers/connection-provider';

/**
 * Returns false when the app is disconnected from the backend.
 * Use this to gate action buttons that would otherwise queue mutations
 * the user can't see going through.
 *
 * NOTE: this is a *connectivity* gate, not an authorization gate. If you
 * need to know whether the current user is allowed to perform an action,
 * use `useCanPerform(action)` instead. Combining the two is intentional
 * — `disabled = !isOnline || !canPerform('apply_discount')`.
 */
export function useIsOnline(): boolean {
  const status = useConnectionStatus();
  return status !== 'disconnected';
}
