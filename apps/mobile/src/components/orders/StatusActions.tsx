import { useTranslation } from '@gustri/i18n';
import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/lib/paper-compat';
import { BRAND_PRIMARY, COLORS } from '@/theme';

interface StatusActionsProps {
  status: string;
  hasItems?: boolean;
  onUpdateStatus: (newStatus: string) => void;
  onNavigatePayment: () => void;
  onNavigateAddItems: () => void;
  isLoading?: boolean;
}

function ActionButton({
  label,
  color,
  onPress,
  loading,
  disabled,
  outlined,
}: {
  label: string;
  color: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  outlined?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.btn,
        outlined
          ? { borderWidth: 1.5, borderColor: color, backgroundColor: 'transparent' }
          : { backgroundColor: color },
        disabled && styles.btnDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={outlined ? color : '#fff'} />
      ) : (
        <Text style={[styles.btnText, outlined && { color }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
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
          <ActionButton
            label={t('orders.startPreparing')}
            color={BRAND_PRIMARY}
            onPress={() => onUpdateStatus('preparing')}
            loading={isLoading}
            disabled={isLoading || !canAdvance}
          />
          <ActionButton
            label={t('orders.addItems')}
            color={BRAND_PRIMARY}
            onPress={onNavigateAddItems}
            outlined
          />
        </>
      )}

      {status === 'preparing' && (
        <>
          {!canAdvance && (
            <Text variant="bodySmall" style={styles.warning}>
              {t('orders.addItemsBefore')}
            </Text>
          )}
          <ActionButton
            label={t('orders.markReady')}
            color={COLORS.success}
            onPress={() => onUpdateStatus('ready')}
            loading={isLoading}
            disabled={isLoading || !canAdvance}
          />
          <ActionButton
            label={t('orders.addItems')}
            color={BRAND_PRIMARY}
            onPress={onNavigateAddItems}
            outlined
          />
        </>
      )}

      {status === 'ready' && (
        <ActionButton
          label={t('orders.markServed')}
          color="#06b6d4"
          onPress={() => onUpdateStatus('served')}
          loading={isLoading}
          disabled={isLoading || !canAdvance}
        />
      )}

      {status === 'served' && (
        <ActionButton
          label={t('orders.processPayment')}
          color="#7c3aed"
          onPress={onNavigatePayment}
        />
      )}

      {['new', 'pending_approval', 'preparing'].includes(status) && (
        <ActionButton
          label={t('orders.cancelOrder')}
          color={COLORS.danger}
          onPress={() => onUpdateStatus('cancelled')}
          outlined
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginTop: 8,
  },
  btn: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.5,
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
