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
    category?: { name?: string | null } | null;
  };
  currencySymbol?: string;
  onToggleAvailability: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export const MenuItemManageCard = React.memo(function MenuItemManageCard({
  item,
  currencySymbol = '$',
  onToggleAvailability,
  onEdit,
  onDelete,
}: MenuItemManageCardProps) {
  const badges = [
    item.is_popular && 'Popular',
    item.is_vegetarian && 'Veg',
    item.is_vegan && 'Vegan',
    item.is_gluten_free && 'GF',
    item.is_spicy && 'Spicy',
    item.is_daily_special && 'Daily Special',
  ].filter(Boolean);

  return (
    <Card style={[styles.card, !item.is_available && styles.unavailable]}>
      <Card.Content style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.itemInfo}>
            <Text variant="titleSmall" style={styles.name}>
              {item.name || 'Unnamed'}
            </Text>
            {item.description && (
              <Text variant="bodySmall" style={styles.desc} numberOfLines={1}>
                {item.description}
              </Text>
            )}
            <Text variant="titleSmall" style={styles.price}>
              {currencySymbol}
              {item.price.toFixed(2)}
            </Text>
          </View>
          <View style={styles.controls}>
            <Switch
              value={!!item.is_available}
              onValueChange={() => onToggleAvailability(item.id)}
            />
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
        </View>

        {badges.length > 0 && (
          <View style={styles.badges}>
            {badges.map((b) => (
              <Chip key={b as string} compact textStyle={{ fontSize: 10 }}>
                {b}
              </Chip>
            ))}
          </View>
        )}

        {item.preparation_time != null && (
          <Text variant="bodySmall" style={styles.muted}>
            Prep: {item.preparation_time} min
          </Text>
        )}
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 8 },
  unavailable: { opacity: 0.5 },
  content: { gap: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemInfo: { flex: 1, gap: 2 },
  name: { fontWeight: '600', color: '#1e293b' },
  desc: { color: '#6b7280' },
  price: { fontWeight: '700', color: '#6366f1' },
  controls: { alignItems: 'flex-end', gap: 4 },
  iconRow: { flexDirection: 'row' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  muted: { color: '#6b7280' },
});
