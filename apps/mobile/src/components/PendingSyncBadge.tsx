import { useTranslation } from '@gustri/i18n';
import { useMutationState } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Badge showing the count of pending (queued) mutations
 * that haven't been sent to the server yet.
 * Visible when mutations are paused (offline).
 */
export function PendingSyncBadge() {
  const { t } = useTranslation('common');
  const pendingMutations = useMutationState({
    filters: { status: 'pending' },
  });

  if (pendingMutations.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('sync.pending', { count: pendingMutations.length })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
    alignSelf: 'center',
    marginBottom: 4,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
