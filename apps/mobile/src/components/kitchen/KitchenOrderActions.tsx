import { ORDER_STATUS } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '@/theme';

interface KitchenOrderActionsProps {
  orderId: string;
  status: string;
  orderType?: string | null;
  allItemsReady: boolean;
  isProcessing: boolean;
  onStartPreparing: (orderId: string) => void;
  onMarkAllReady: (orderId: string) => void;
  onMarkAllServed: (orderId: string) => void;
}

export const KitchenOrderActions = React.memo(function KitchenOrderActions({
  orderId,
  status,
  orderType,
  allItemsReady,
  isProcessing,
  onStartPreparing,
  onMarkAllReady,
  onMarkAllServed,
}: KitchenOrderActionsProps) {
  const { t } = useTranslation('staff');

  return (
    <View style={styles.actions}>
      {status === ORDER_STATUS.NEW && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: COLORS.warning }]}
          onPress={() => onStartPreparing(orderId)}
          disabled={isProcessing}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('kitchen.startPreparing')}
          accessibilityState={{ disabled: isProcessing, busy: isProcessing }}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={[styles.actionBtnText, { color: '#000' }]}>
              {t('kitchen.startPreparing')}
            </Text>
          )}
        </TouchableOpacity>
      )}
      {status === ORDER_STATUS.PREPARING && allItemsReady && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: COLORS.success }]}
          onPress={() => onMarkAllReady(orderId)}
          disabled={isProcessing}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('kitchen.allReady')}
          accessibilityState={{ disabled: isProcessing, busy: isProcessing }}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.actionBtnText}>{t('kitchen.allReady')}</Text>
          )}
        </TouchableOpacity>
      )}
      {status === ORDER_STATUS.READY && orderType !== 'delivery' && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#8b5cf6' }]}
          onPress={() => onMarkAllServed(orderId)}
          disabled={isProcessing}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('kitchen.allServed')}
          accessibilityState={{ disabled: isProcessing, busy: isProcessing }}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.actionBtnText}>{t('kitchen.allServed')}</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  actions: {
    marginTop: 12,
    gap: 8,
  },
  actionBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
