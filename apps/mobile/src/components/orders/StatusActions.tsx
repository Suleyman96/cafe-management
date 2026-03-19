import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';

interface StatusActionsProps {
  status: string;
  onUpdateStatus: (newStatus: string) => void;
  onNavigatePayment: () => void;
  onNavigateAddItems: () => void;
  isLoading?: boolean;
}

export const StatusActions = React.memo(function StatusActions({
  status,
  onUpdateStatus,
  onNavigatePayment,
  onNavigateAddItems,
  isLoading = false,
}: StatusActionsProps) {
  return (
    <View style={styles.container}>
      {(status === 'new' || status === 'pending_approval') && (
        <>
          <Button
            mode="contained"
            onPress={() => onUpdateStatus('preparing')}
            loading={isLoading}
            disabled={isLoading}
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
          <Button
            mode="contained"
            onPress={() => onUpdateStatus('ready')}
            loading={isLoading}
            disabled={isLoading}
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
          disabled={isLoading}
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
});
