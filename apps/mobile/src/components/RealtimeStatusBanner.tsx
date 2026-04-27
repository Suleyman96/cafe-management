import { useTranslation } from '@gustri/i18n';
import { StyleSheet, Text, View } from 'react-native';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useRealtimeStatusStore } from '@/store/realtime-status-store';

/**
 * Surfaced when at least one realtime channel has exhausted its retry budget
 * and is now relying on the 2-minute fallback poll. Hidden when the device
 * is offline (the OfflineBanner above it already explains the more severe
 * problem) or when realtime is healthy.
 */
export function RealtimeStatusBanner() {
  const { t } = useTranslation('common');
  const { isOnline } = useNetworkStatus();
  const isDegraded = useRealtimeStatusStore((s) => s.isAnyDegraded());

  if (!isOnline || !isDegraded) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('realtime.degraded')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FCD34D',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#78350F',
    fontSize: 13,
    fontWeight: '600',
  },
});
