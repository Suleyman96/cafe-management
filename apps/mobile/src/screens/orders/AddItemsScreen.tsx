import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip } from 'react-native-paper';
import { MenuItemCard } from '@/components/orders/MenuItemCard';
import { ErrorScreen, LoadingScreen } from '@/components/ui';
import { useAddOrderItems, useCategories, useMenuItems } from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import type { OrdersStackParamList } from '@/types';

type Route = RouteProp<OrdersStackParamList, 'AddItems'>;
type Nav = StackNavigationProp<OrdersStackParamList, 'AddItems'>;

interface CartItem {
  menuItemId: string;
  quantity: number;
  price: number;
  name: string;
}

export default function AddItemsScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { orderId } = route.params;
  const { showSuccess, showError } = useSnackbar();

  const {
    data: menuItems,
    isLoading: menuLoading,
    error: menuError,
  } = useMenuItems({ isAvailable: true });
  const { data: categories } = useCategories();
  const addOrderItems = useAddOrderItems();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<Record<string, CartItem>>({});

  const filteredItems = useMemo(() => {
    if (!menuItems) return [];
    if (selectedCategory === 'all') return menuItems;
    return menuItems.filter((item: any) => item.category_id === selectedCategory);
  }, [menuItems, selectedCategory]);

  const cartSummary = useMemo(() => {
    const items = Object.values(cart);
    return {
      count: items.reduce((sum, i) => sum + i.quantity, 0),
      total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    };
  }, [cart]);

  const handleAdd = (item: any) => {
    setCart((prev) => {
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: {
          menuItemId: item.id,
          quantity: (existing?.quantity || 0) + 1,
          price: item.price,
          name: item.name || 'Item',
        },
      };
    });
  };

  const handleRemove = (itemId: string) => {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing || existing.quantity <= 1) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [itemId]: { ...existing, quantity: existing.quantity - 1 },
      };
    });
  };

  const handleSubmit = async () => {
    const items = Object.values(cart).map((c) => ({
      order_id: orderId,
      menu_item_id: c.menuItemId,
      quantity: c.quantity,
      item_name: c.name,
      item_price: c.price,
      notes: null as string | null,
      status: 'pending' as const,
    }));

    if (items.length === 0) return;

    try {
      await addOrderItems.mutateAsync(items);
      showSuccess(`Added ${cartSummary.count} items`);
      navigation.goBack();
    } catch (err: any) {
      showError(err?.message || 'Failed to add items');
    }
  };

  if (menuLoading) return <LoadingScreen message="Loading menu..." />;
  if (menuError) return <ErrorScreen error={menuError} />;

  return (
    <View style={styles.container}>
      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
        <Chip
          selected={selectedCategory === 'all'}
          onPress={() => setSelectedCategory('all')}
          style={styles.categoryChip}
          compact
        >
          All
        </Chip>
        {categories?.map((cat) => (
          <Chip
            key={cat.id}
            selected={selectedCategory === cat.id}
            onPress={() => setSelectedCategory(cat.id)}
            style={styles.categoryChip}
            compact
          >
            {cat.name || 'Category'}
          </Chip>
        ))}
      </ScrollView>

      {/* Menu items */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MenuItemCard
            menuItem={item}
            quantity={cart[item.id]?.quantity || 0}
            onAdd={() => handleAdd(item)}
            onRemove={() => handleRemove(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
      />

      {/* Cart footer */}
      {cartSummary.count > 0 && (
        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={addOrderItems.isPending}
            disabled={addOrderItems.isPending}
            contentStyle={styles.submitButtonContent}
          >
            Add {cartSummary.count} item{cartSummary.count > 1 ? 's' : ''} — $
            {cartSummary.total.toFixed(2)}
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  categoryRow: { paddingHorizontal: 12, paddingVertical: 8, maxHeight: 52 },
  categoryChip: { marginHorizontal: 4 },
  list: { paddingTop: 4, paddingBottom: 100 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  submitButtonContent: { paddingVertical: 6 },
});
