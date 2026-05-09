import { useTranslation } from '@gustri/i18n';
import type { ActiveKitchenFilter } from '@gustri/queries';
import { Pressable, StyleSheet, Text } from 'react-native';

/**
 * Compact pill that always tells the cook what they're looking at:
 * "Showing all categories" or "Showing: Pizza, Grill". Tap to open the
 * filter bottom sheet. Designed for the dark kitchen header — same role
 * as the staff-web `KitchenFilterBar`, but a touch larger to be easy to
 * tap during a rush.
 */
interface KitchenFilterBarProps {
  activeFilter: ActiveKitchenFilter;
  onPress: () => void;
}

export function KitchenFilterBar({ activeFilter, onPress }: KitchenFilterBarProps) {
  const { t } = useTranslation('staff');

  const label =
    activeFilter.mode === 'all'
      ? t('kitchen.filter.allCategories')
      : t('kitchen.filter.showingCategories', { names: activeFilter.names.join(', ') });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  pressed: {
    opacity: 0.6,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
