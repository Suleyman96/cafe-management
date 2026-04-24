import { useConnectionStatus } from '@/components/providers/connection-provider';

/**
 * Returns false when the app is disconnected from the backend.
 * Use this to disable action buttons that would trigger mutations.
 */
export function useCanMutate(): boolean {
  const status = useConnectionStatus();
  return status !== 'disconnected';
}
