import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@gustri/i18n';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, IconButton, Switch } from 'react-native-paper';
import { Text } from '@/lib/paper-compat';

interface MenuItemManageCardProps {
  item: {
    id: string;
    name?: string | null;
    description?: string | null;
    price: number;
    is_available?: boolean;
    is_popular?: boolean;
    is_vegetarian?: boolean;
    is_vegan?: boolean;
    is_gluten_free?: boolean;
    is_spicy?: boolean;
    is_daily_special?: boolean;
    preparation_time?: number | null;
    category?: { name?: string | null; icon?: string | null } | null;
  };
  currencySymbol?: string;
  onToggleAvailability: (id: string, currentAvailable: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const BADGE_CONFIG: Record<string, { emoji: string; bg: string; text: string }> = {
  is_popular: { emoji: '⭐', bg: '#fefce8', text: '#a16207' },
  is_vegetarian: { emoji: '🌱', bg: '#f0fdf4', text: '#15803d' },
  is_vegan: { emoji: '🌿', bg: '#f0fdf4', text: '#15803d' },
  is_gluten_free: { emoji: '🌾', bg: '#eff6ff', text: '#1d4ed8' },
  is_spicy: { emoji: '🌶️', bg: '#fef2f2', text: '#dc2626' },
};

export const MenuItemManageCard = React.memo(function MenuItemManageCard({
  item,
  currencySymbol = '$',
  onToggleAvailability,
  onEdit,
  onDelete,
}: MenuItemManageCardProps) {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const dietaryBadges = Object.entries(BADGE_CONFIG).filter(
    ([key]) => item[key as keyof typeof item],
  );

  return (
    <Card style={[styles.card, !item.is_available && styles.unavailableCard]}>
      <Card.Content style={styles.content}>
        {/* Category emoji placeholder */}
        <View style={styles.topRow}>
          <View style={styles.emojiBox}>
            <Text style={styles.emoji}>{item.category?.icon || '🍽️'}</Text>
          </View>

          <View style={styles.itemInfo}>
            <Text variant="titleSmall" style={styles.name} numberOfLines={1}>
              {item.name || 'Unnamed'}
            </Text>
            {item.description && (
              <Text variant="bodySmall" style={styles.desc} numberOfLines={1}>
                {item.description}
              </Text>
            )}
            <View style={styles.priceRow}>
              <Text variant="titleSmall" style={styles.price}>
                {currencySymbol}
                {item.price.toFixed(2)}
              </Text>
              {item.preparation_time != null && (
                <View style={styles.prepRow}>
                  <MaterialCommunityIcons name="clock-outline" size={12} color="#9ca3af" />
                  <Text variant="bodySmall" style={styles.prepText}>
                    {item.preparation_time} min
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Unavailable overlay badge */}
        {!item.is_available && (
          <Chip
            compact
            style={styles.unavailableBadge}
            textStyle={{ color: '#fff', fontSize: 10, fontWeight: '700' }}
          >
            {t('menu.unavailable')}
          </Chip>
        )}

        {/* Daily Special badge */}
        {item.is_daily_special && item.is_available && (
          <Chip
            compact
            style={styles.dailySpecialBadge}
            textStyle={{ color: '#fff', fontSize: 10, fontWeight: '700' }}
          >
            ✨ {t('menu.dailySpecial')}
          </Chip>
        )}

        {/* Color-coded dietary badges */}
        {dietaryBadges.length > 0 && (
          <View style={styles.badges}>
            {dietaryBadges.map(([key, config]) => (
              <Chip
                key={key}
                compact
                style={{ backgroundColor: config.bg, height: 22 }}
                textStyle={{ color: config.text, fontSize: 10, fontWeight: '600' }}
              >
                {config.emoji} {key.replace(/^is_/, '').replace(/_/g, ' ')}
              </Chip>
            ))}
          </View>
        )}

        {/* Actions row with separator */}
        <View style={styles.separator} />
        <View style={styles.actionsRow}>
          <View style={styles.toggleRow}>
            <Switch
              value={!!item.is_available}
              onValueChange={() => onToggleAvailability(item.id, !!item.is_available)}
            />
            <Text
              variant="bodySmall"
              style={item.is_available ? styles.availableText : styles.unavailableText}
            >
              {item.is_available ? t('menu.available') : tCommon('inactive')}
            </Text>
          </View>
          <View style={styles.iconRow}>
            <IconButton icon="pencil" size={18} onPress={() => onEdit(item.id)} />
            <IconButton
              icon="delete"
              size={18}
              iconColor="#ef4444"
              onPress={() => onDelete(item.id)}
            />
          </View>
        </View>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 8 },
  unavailableCard: { borderColor: '#fca5a5', borderWidth: 1 },
  content: { gap: 6 },
  topRow: { flexDirection: 'row', gap: 10 },
  emojiBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 24 },
  itemInfo: { flex: 1, gap: 2 },
  name: { fontWeight: '600', color: '#1e293b' },
  desc: { color: '#6b7280' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  price: { fontWeight: '700', color: '#6366f1' },
  prepRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  prepText: { color: '#9ca3af', fontSize: 11 },
  unavailableBadge: { backgroundColor: '#ef4444', alignSelf: 'flex-start' },
  dailySpecialBadge: { backgroundColor: '#f59e0b', alignSelf: 'flex-start' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  separator: { height: 1, backgroundColor: '#f1f5f9', marginTop: 2 },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  availableText: { color: '#16a34a', fontSize: 12, fontWeight: '600' },
  unavailableText: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  iconRow: { flexDirection: 'row' },
});
