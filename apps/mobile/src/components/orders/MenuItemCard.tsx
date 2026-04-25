import { useTranslation } from '@gustri/i18n';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/lib/paper-compat';
import { BRAND_PRIMARY, COLORS } from '@/theme';

interface MenuItemCardProps {
  menuItem: {
    id: string;
    name?: string | null;
    description?: string | null;
    price: number;
    is_available?: boolean | null;
  };
  quantity: number;
  currencySymbol: string;
  onAdd: () => void;
  onRemove: () => void;
}

export const MenuItemCard = React.memo(function MenuItemCard({
  menuItem,
  quantity,
  currencySymbol,
  onAdd,
  onRemove,
}: MenuItemCardProps) {
  const { t } = useTranslation('staff');
  const unavailable = menuItem.is_available === false;

  return (
    <View style={[styles.card, unavailable && styles.unavailable]}>
      <View style={styles.info}>
        <Text variant="bodyMedium" style={styles.name} numberOfLines={2}>
          {menuItem.name || t('orders.unnamed')}
        </Text>
        <Text variant="bodySmall" style={styles.price}>
          {currencySymbol}
          {menuItem.price.toFixed(2)}
        </Text>
      </View>

      {unavailable ? (
        <View style={styles.unavailableBadge}>
          <Text style={styles.unavailableText}>{t('orders.unavailable')}</Text>
        </View>
      ) : (
        <View style={styles.quantityControl}>
          {quantity > 0 ? (
            <>
              <TouchableOpacity style={styles.qtyBtn} onPress={onRemove}>
                <Text style={styles.qtyBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.quantity}>{quantity}</Text>
            </>
          ) : null}
          <TouchableOpacity
            style={[styles.qtyBtn, styles.qtyBtnAdd, quantity > 0 && styles.qtyBtnAddActive]}
            onPress={onAdd}
          >
            <Text
              style={[
                styles.qtyBtnText,
                quantity > 0 ? styles.qtyBtnAddActiveText : styles.qtyBtnAddText,
              ]}
            >
              +
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.card,
  },
  unavailable: {
    opacity: 0.4,
  },
  info: {
    flex: 1,
    marginRight: 12,
    gap: 2,
  },
  name: {
    fontWeight: '600',
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  price: {
    fontWeight: '700',
    color: BRAND_PRIMARY,
    fontSize: 13,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  qtyBtnAdd: {
    backgroundColor: COLORS.brandLight,
  },
  qtyBtnAddActive: {
    backgroundColor: BRAND_PRIMARY,
  },
  qtyBtnAddText: {
    color: BRAND_PRIMARY,
  },
  qtyBtnAddActiveText: {
    color: '#fff',
  },
  quantity: {
    minWidth: 20,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  unavailableBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unavailableText: {
    color: COLORS.danger,
    fontSize: 10,
    fontWeight: '600',
  },
});
