import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

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
  const canAdvance = hasItems;

  return (
    <View style={styles.container}>
      {(status === 'new' || status === 'pending_approval') && (
        <>
          {!canAdvance && (
            <Text variant="bodySmall" style={styles.warning}>
              Add items before advancing this order
            </Text>
          )}
          <Button
            mode="contained"
            onPress={() => onUpdateStatus('preparing')}
            loading={isLoading}
            disabled={isLoading || !canAdvance}
            icon="chef-hat"
            style={styles.primaryButton}
          >
            Start Preparing
          </Button>
          <Button mode="outlined" onPress={onNavigateAddItems} icon="plus">
            Add Items
          </Button>
        </>
      )}

      {status === 'preparing' && (
        <>
          {!canAdvance && (
            <Text variant="bodySmall" style={styles.warning}>
              Add items before advancing this order
            </Text>
          )}
          <Button
            mode="contained"
            onPress={() => onUpdateStatus('ready')}
            loading={isLoading}
            disabled={isLoading || !canAdvance}
            icon="check-circle"
            style={[styles.primaryButton, { backgroundColor: '#10b981' }]}
          >
            Mark Ready
          </Button>
          <Button mode="outlined" onPress={onNavigateAddItems} icon="plus">
            Add Items
          </Button>
        </>
      )}

      {status === 'ready' && (
        <Button
          mode="contained"
          onPress={() => onUpdateStatus('served')}
          loading={isLoading}
          disabled={isLoading || !canAdvance}
          icon="silverware-fork-knife"
          style={[styles.primaryButton, { backgroundColor: '#06b6d4' }]}
        >
          Mark Served
        </Button>
      )}

      {status === 'served' && (
        <Button
          mode="contained"
          onPress={onNavigatePayment}
          icon="credit-card"
          style={[styles.primaryButton, { backgroundColor: '#7c3aed' }]}
        >
          Process Payment
        </Button>
      )}

      {['new', 'pending_approval', 'preparing'].includes(status) && (
        <Button
          mode="outlined"
          onPress={() => onUpdateStatus('cancelled')}
          textColor="#ef4444"
          style={styles.cancelButton}
          icon="close-circle"
        >
          Cancel Order
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
  primaryButton: {},
  cancelButton: {
    borderColor: '#fecaca',
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
