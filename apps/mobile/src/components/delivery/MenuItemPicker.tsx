import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MenuItem } from '@gustri/database/types';
import { useTranslation } from '@gustri/i18n';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/lib/paper-compat';
import { COLORS } from '@/theme';

/** Minimal category shape this picker renders. */
interface PickerCategory {
  id: string;
  name: string;
}

interface MenuItemPickerProps {
  loading: boolean;
  categories: PickerCategory[] | undefined;
  /** Menu items already filtered to the selected category by the parent. */
  filteredMenuItems: MenuItem[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string) => void;
  /** Current cart quantity for a given menu item id (0 when not in cart). */
  getQuantity: (id: string) => number;
  onAddItem: (item: MenuItem) => void;
  currencySymbol: string;
}

/**
 * Category chip bar + item list for the create-delivery modal. Selection and
 * filtering state live in the parent; this component renders the chips, the
 * rows for the current category, and the in-cart "Nx" badge.
 */
export const MenuItemPicker = React.memo(function MenuItemPicker({
  loading,
  categories,
  filteredMenuItems,
  selectedCategoryId,
  onSelectCategory,
  getQuantity,
  onAddItem,
  currencySymbol,
}: MenuItemPickerProps) {
  const { t } = useTranslation('staff');

  if (loading) {
    return (
      <Text variant="bodySmall" style={styles.muted}>
        {t('orders.loadingMenu')}
      </Text>
    );
  }

  return (
    <>
      {/* Categories chip bar */}
      {categories && categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {categories.map((cat) => {
            const active = cat.id === selectedCategoryId;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => onSelectCategory(cat.id)}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
              >
                <Text
                  variant="labelMedium"
                  style={[styles.categoryChipText, active && styles.categoryChipTextActive]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Items in selected category. Empty state intentionally
        omitted — a category with zero available items is rare
        and self-explanatory (the chip is selected but no rows
        render). Adding a key here would block PR on 20-locale
        translation for a near-unreachable string. */}
      {filteredMenuItems.length > 0 && (
        <View style={styles.menuItemsList}>
          {filteredMenuItems.map((item) => {
            const inCart = getQuantity(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => onAddItem(item)}
                style={styles.menuItemRow}
              >
                <View style={styles.menuItemInfo}>
                  <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                    {item.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.muted}>
                    {currencySymbol}
                    {item.price.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.menuItemAdd}>
                  {inCart > 0 && (
                    <Text variant="labelMedium" style={styles.inCartBadge}>{`${inCart}x`}</Text>
                  )}
                  <MaterialCommunityIcons name="plus-circle" size={22} color={COLORS.purple} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </>
  );
});

const styles = StyleSheet.create({
  muted: { color: COLORS.textMuted },
  categoryRow: { gap: 6, paddingVertical: 4 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: COLORS.borderLight,
  },
  categoryChipActive: { backgroundColor: COLORS.purple },
  categoryChipText: { color: COLORS.textSecondary, fontWeight: '600' },
  categoryChipTextActive: { color: '#fff' },
  menuItemsList: { gap: 6 },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: COLORS.borderLight,
  },
  menuItemInfo: { flex: 1, marginRight: 8 },
  menuItemAdd: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inCartBadge: {
    color: COLORS.purple,
    fontWeight: '700',
  },
});
