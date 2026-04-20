import { StyleSheet, Text, View } from 'react-native';
import { useNetworkStatus } from '@/hooks/use-network-status';

/**
 * Persistent banner shown at the top of the app when offline.
 * Informs the waiter that changes will sync when connectivity returns.
 */
export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>You're offline — changes will sync when connected</Text>
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
