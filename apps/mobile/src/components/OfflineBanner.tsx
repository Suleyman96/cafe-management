import { useTranslation } from '@gustri/i18n';
import { StyleSheet, Text, View } from 'react-native';
import { useNetworkStatus } from '@/hooks/use-network-status';

/**
 * Persistent banner shown at the top of the app when offline.
 * Informs the waiter that changes will sync when connectivity returns.
 *
 * When the device is on a captive-portal network (NetInfo says connected,
 * but the API is unreachable), shows different copy directing the user to
 * authenticate with the network — otherwise they may stand confused at a
 * "connected" Wi-Fi indicator while every mutation fails.
 */
export function OfflineBanner() {
  const { t } = useTranslation('common');
  const { isOnline, captivePortal } = useNetworkStatus();

  if (isOnline) return null;

  const message = captivePortal ? t('online.captive_portal') : t('offline.message');

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F59E0B',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
