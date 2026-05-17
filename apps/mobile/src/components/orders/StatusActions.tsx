/**
 * Per-status order action buttons (Start Preparing / Mark Ready / Mark
 * Served / Process Payment / Cancel). Uses the unified `Button` component
 * from `@gustri/ui-mobile`, which satisfies the `ButtonContract` shared
 * with web — so the same `variant="destructive"` paints red on both
 * surfaces. The legacy inline `ActionButton` (TouchableOpacity wrapper
 * with hex colors per status) was removed: status-specific color cues
 * now come from semantic variants, not arbitrary palette picks.
 */
import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-mobile';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/lib/paper-compat';

interface StatusActionsProps {
  status: string;
  hasItems?: boolean;
  onUpdateStatus: (newStatus: string) => void;
  onNavigatePayment: () => void;
  onNavigateAddItems: () => void;
  isLoading?: boolean;
}

export const StatusActions = React.memo(function StatusActions({
  status,
  hasItems = true,
  onUpdateStatus,
  onNavigatePayment,
  onNavigateAddItems,
  isLoading = false,
}: StatusActionsProps) {
  const { t } = useTranslation('staff');

  const canAdvance = hasItems;

  return (
    <View style={styles.container}>
      {(status === 'new' || status === 'pending_approval') && (
        <>
          {!canAdvance && (
            <Text variant="bodySmall" style={styles.warning}>
              {t('orders.addItemsBefore')}
            </Text>
          )}
          <Button
            variant="primary"
            size="lg"
            onPress={() => onUpdateStatus('preparing')}
            loading={isLoading}
            disabled={isLoading || !canAdvance}
          >
            {t('orders.startPreparing')}
          </Button>
          <Button variant="outline" size="lg" onPress={onNavigateAddItems}>
            {t('orders.addItems')}
          </Button>
        </>
      )}

      {status === 'preparing' && (
        <>
          {!canAdvance && (
            <Text variant="bodySmall" style={styles.warning}>
              {t('orders.addItemsBefore')}
            </Text>
          )}
          <Button
            variant="primary"
            size="lg"
            onPress={() => onUpdateStatus('ready')}
            loading={isLoading}
            disabled={isLoading || !canAdvance}
          >
            {t('orders.markReady')}
          </Button>
          <Button variant="outline" size="lg" onPress={onNavigateAddItems}>
            {t('orders.addItems')}
          </Button>
        </>
      )}

      {status === 'ready' && (
        <Button
          variant="primary"
          size="lg"
          onPress={() => onUpdateStatus('served')}
          loading={isLoading}
          disabled={isLoading || !canAdvance}
        >
          {t('orders.markServed')}
        </Button>
      )}

      {status === 'served' && (
        <Button variant="primary" size="lg" onPress={onNavigatePayment}>
          {t('orders.processPayment')}
        </Button>
      )}

      {['new', 'pending_approval', 'preparing'].includes(status) && (
        <Button variant="destructive" size="lg" onPress={() => onUpdateStatus('cancelled')}>
          {t('orders.cancelOrder')}
        </Button>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginTop: 8,
  },
  warning: {
    color: '#d97706',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    textAlign: 'center',
  },
});
