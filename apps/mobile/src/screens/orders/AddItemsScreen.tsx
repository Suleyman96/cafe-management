import { useTranslation } from '@gustri/i18n';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, IconButton } from 'react-native-paper';
import { MenuItemCard } from '@/components/orders/MenuItemCard';
import { ErrorScreen, LoadingScreen } from '@/components/ui';
import { useAddOrderItems, useCategories, useCreateOrder, useMenuItems } from '@/hooks';
import { useCafeSettings } from '@/hooks/use-cafe-settings';
import { useSnackbar } from '@/hooks/use-snackbar';
import { Text } from '@/lib/paper-compat';
import { useAuthStore } from '@/store/auth-store';
import type { OrdersStackParamList } from '@/types';

type Route = RouteProp<OrdersStackParamList, 'AddItems'>;
type Nav = StackNavigationProp<OrdersStackParamList, 'AddItems'>;

interface CartItem {
  menuItemId: string;
  quantity: number;
  price: number;
  name: string;
}

const FOOTER_HEIGHT = 64;

export default function AddItemsScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const params = route.params as { orderId?: string; tableId?: string };
  const orderId = params.orderId;
  const tableId = params.tableId;
  const isNewOrder = !orderId && !!tableId;
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();
  const { t } = useTranslation('staff');
  const { data: settings } = useCafeSettings();
  const currencySymbol = settings?.currency_symbol || '$';

  const {
    data: menuItems,
    isLoading: menuLoading,
    error: menuError,
  } = useMenuItems({ isAvailable: true });
  const { data: categories } = useCategories();
  const addOrderItems = useAddOrderItems();
  const createOrder = useCreateOrder();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [submitting, setSubmitting] = useState(false);

  // Auto-select first category (no "All" option)
  useEffect(() => {
    if (categories?.length && selectedCategory === null) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);

  const filteredItems = useMemo(() => {
    if (!menuItems) return [];
    if (!selectedCategory) return menuItems;
    return menuItems.filter((item: any) => item.category_id === selectedCategory);
  }, [menuItems, selectedCategory]);

  const cartSummary = useMemo(() => {
    const items = Object.values(cart);
    return {
      count: items.reduce((sum, i) => sum + i.quantity, 0),
      total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    };
  }, [cart]);

  const cartItems = Object.values(cart);
  const hasCartItems = cartItems.length > 0;

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
    const items = Object.values(cart);
    if (items.length === 0) return;

    setSubmitting(true);
    try {
      let targetOrderId = orderId;

      if (isNewOrder && tableId) {
        const newOrder = await createOrder.mutateAsync({
          table_id: tableId,
          order_type: 'dine_in',
          status: 'new',
          source: 'waiter',
          assigned_waiter_id: staff?.id ?? null,
          customer_name: null,
          customer_phone: null,
          subtotal: 0,
          tax: 0,
          total: 0,
          customer_notes: null,
          internal_notes: null,
          payment_method: null,
          preparing_at: null,
          ready_at: null,
          served_at: null,
          closed_at: null,
          paid_at: null,
          delivery_address: null,
          delivery_fee: 0,
          delivery_notes: null,
          estimated_delivery_time: null,
          delivered_at: null,
          delivery_person_id: null,
        });
        targetOrderId = newOrder.id;
      }

      const orderItems = items.map((c) => ({
        order_id: targetOrderId!,
        menu_item_id: c.menuItemId,
        quantity: c.quantity,
        item_name: c.name,
        item_price: c.price,
        notes: null as string | null,
        status: 'pending' as const,
      }));

      await addOrderItems.mutateAsync(orderItems);
      showSuccess(isNewOrder ? t('orders.orderCreatedSuccess') : t('orders.itemsAddedToOrder'));
      navigation.goBack();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('orders.failedAddItems'));
    } finally {
      setSubmitting(false);
    }
  };

  if (menuLoading) return <LoadingScreen message={t('orders.loadingMenu')} />;
  if (menuError) return <ErrorScreen error={menuError} />;

  const isLoading = submitting || addOrderItems.isPending;

  return (
    <View style={styles.container}>
      {/* Menu — top section (categories sidebar + items) */}
      <View style={[styles.menuSection, hasCartItems && styles.menuSectionHalf]}>
        <View style={styles.content}>
          {/* Category Sidebar */}
          <ScrollView
            style={styles.categorySidebar}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.categorySidebarContent}
          >
            {categories?.map((cat: any) => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                style={[
                  styles.categoryItem,
                  selectedCategory === cat.id && styles.categoryItemActive,
                ]}
              >
                <Text style={styles.categoryIcon}>{cat.icon || '📋'}</Text>
                <Text style={styles.categoryLabel} numberOfLines={1}>
                  {cat.name || 'Category'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Menu Items */}
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
            style={styles.menuList}
            contentContainerStyle={styles.menuListContent}
          />
        </View>
      </View>

      {/* Cart — bottom section */}
      {hasCartItems && (
        <View style={styles.cartSection}>
          {/* Cart header */}
          <View style={styles.cartHeader}>
            <IconButton icon="cart" size={18} iconColor="#2563eb" style={styles.cartHeaderIcon} />
            <Text variant="titleSmall" style={styles.cartHeaderTitle}>
              {isNewOrder ? t('orders.newOrder') : t('orders.addItems')}
            </Text>
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartSummary.count}</Text>
            </View>
          </View>

          {/* Cart items — scrollable */}
          <ScrollView
            style={styles.cartScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.cartScrollContent}
          >
            {cartItems.map((item) => (
              <View key={item.menuItemId} style={styles.cartItem}>
                <View style={styles.cartItemInfo}>
                  <Text variant="bodyMedium" style={styles.cartItemName}>
                    {item.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.cartItemPrice}>
                    {currencySymbol}
                    {item.price.toFixed(2)} x {item.quantity}
                  </Text>
                </View>
                <View style={styles.cartItemControls}>
                  <IconButton
                    icon="minus"
                    mode="contained-tonal"
                    size={16}
                    onPress={() => handleRemove(item.menuItemId)}
                  />
                  <Text style={styles.cartItemQty}>{item.quantity}</Text>
                  <IconButton
                    icon="plus"
                    mode="contained"
                    size={16}
                    onPress={() =>
                      handleAdd({
                        id: item.menuItemId,
                        price: item.price,
                        name: item.name,
                      })
                    }
                  />
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Fixed footer — total + submit */}
      {hasCartItems && (
        <View style={styles.footer}>
          <View style={styles.footerInfo}>
            <View style={styles.footerBadge}>
              <Text style={styles.footerBadgeText}>{cartSummary.count}</Text>
            </View>
            <Text variant="titleSmall" style={styles.footerTotal}>
              {currencySymbol}
              {cartSummary.total.toFixed(2)}
            </Text>
          </View>
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={isLoading}
            disabled={isLoading}
            compact
          >
            {isNewOrder ? t('orders.createOrder') : t('orders.addItems')}
          </Button>
        </View>
      )}
    </View>
  );
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  menuSection: { flex: 1 },
  menuSectionHalf: { height: SCREEN_HEIGHT * 0.45, flex: 0 },
  content: { flex: 1, flexDirection: 'row' },
  categorySidebar: {
    width: 88,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  categorySidebarContent: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  categoryItem: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  categoryItemActive: {
    backgroundColor: '#dbeafe',
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4b5563',
    marginTop: 2,
    textAlign: 'center',
  },
  menuList: {
    flex: 1,
  },
  menuListContent: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  cartSection: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f9fafb',
  },
  cartHeaderIcon: {
    margin: 0,
  },
  cartHeaderTitle: {
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  cartBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  cartBadgeText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
  cartScroll: {
    flex: 1,
  },
  cartScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: FOOTER_HEIGHT + 8,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cartItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  cartItemName: {
    fontWeight: '600',
    color: '#1e293b',
  },
  cartItemPrice: {
    color: '#6b7280',
  },
  cartItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartItemQty: {
    minWidth: 24,
    textAlign: 'center',
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: FOOTER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  footerBadgeText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
  footerTotal: {
    fontWeight: '700',
    color: '#1e293b',
  },
});
