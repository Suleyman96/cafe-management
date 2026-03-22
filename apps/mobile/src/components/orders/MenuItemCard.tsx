import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, IconButton } from 'react-native-paper';
import { Text } from '@/lib/paper-compat';

interface MenuItemCardProps {
  menuItem: {
    id: string;
    name_en?: string | null;
    description_en?: string | null;
    price: number;
    is_available?: boolean | null;
  };
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}

export const MenuItemCard = React.memo(function MenuItemCard({
  menuItem,
  quantity,
  onAdd,
  onRemove,
}: MenuItemCardProps) {
  const unavailable = menuItem.is_available === false;

  return (
    <Card style={[styles.card, unavailable && styles.unavailable]}>
      <Card.Content style={styles.content}>
        <View style={styles.info}>
          <Text variant="bodyLarge" style={styles.name}>
            {menuItem.name_en || 'Unnamed'}
          </Text>
          {menuItem.description_en && (
            <Text variant="bodySmall" style={styles.description} numberOfLines={2}>
              {menuItem.description_en}
            </Text>
          )}
          <Text variant="titleSmall" style={styles.price}>
            ${menuItem.price.toFixed(2)}
          </Text>
        </View>

        <View style={styles.quantityControl}>
          <IconButton
            icon="minus"
            mode="contained-tonal"
            size={18}
            onPress={onRemove}
            disabled={quantity === 0 || unavailable}
          />
          <Text variant="titleMedium" style={styles.quantity}>
            {quantity}
          </Text>
          <IconButton
            icon="plus"
            mode="contained"
            size={18}
            onPress={onAdd}
            disabled={unavailable}
          />
        </View>
      </Card.Content>
      {unavailable && (
        <View style={styles.unavailableOverlay}>
          <Text variant="labelMedium" style={styles.unavailableText}>
            Unavailable
          </Text>
        </View>
      )}
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  unavailable: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginRight: 12,
    gap: 2,
  },
  name: {
    fontWeight: '600',
    color: '#1e293b',
  },
  description: {
    color: '#6b7280',
  },
  price: {
    fontWeight: '700',
    color: '#2563eb',
    marginTop: 4,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quantity: {
    minWidth: 24,
    textAlign: 'center',
    fontWeight: '700',
  },
  unavailableOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unavailableText: {
    color: '#fff',
    fontSize: 10,
  },
});
