import { useTranslation } from '@gustri/i18n';
import { useMutationState } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Badge showing the count of paused (offline-queued) mutations
 * waiting to replay when connectivity returns.
 *
 * Filters on `mutation.state.isPaused` rather than `status: 'pending'` —
 * `'pending'` matches in-flight mutations (currently executing), which would
 * cause the badge to flicker on every quick online mutation. Paused mutations
 * are the ones the user actually owes the server.
 */
export function PendingSyncBadge() {
  const { t } = useTranslation('common');
  const pausedCount = useMutationState({
    filters: { predicate: (m) => m.state.isPaused === true },
    select: (m) => m.mutationId,
  }).length;

  if (pausedCount === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('sync.pending', { count: pausedCount })}</Text>
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
