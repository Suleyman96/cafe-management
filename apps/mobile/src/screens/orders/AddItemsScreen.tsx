import { applyMenuFilter, deriveChannelFilter } from '@gustri/core';
import { type MenuItem, ORDER_ITEM_STATUS } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { ErrorScreen, LoadingScreen } from '@gustri/ui-mobile';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MenuItemCard } from '@/components/orders/MenuItemCard';
import { useCategories, useCreateOrder, useCurrencySymbol, useOrder } from '@/hooks/local';
import { useAddOrderItems, useMenuItems } from '@/hooks/shared';
import { useOrderCart } from '@/hooks/use-order-cart';
import { useSnackbar } from '@/hooks/use-snackbar';
import { Text } from '@/lib/paper-compat';
import { useAuthStore } from '@/store/auth-store';
import { BRAND_PRIMARY, COLORS } from '@/theme';
import type { OrdersStackParamList } from '@/types';

type Route = RouteProp<OrdersStackParamList, 'AddItems'>;
type Nav = StackNavigationProp<OrdersStackParamList, 'AddItems'>;

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
  const currencySymbol = useCurrencySymbol();
  const insets = useSafeAreaInsets();

  const {
    data: menuItems,
    isLoading: menuLoading,
    error: menuError,
    refetch: refetchMenu,
  } = useMenuItems({ isAvailable: true });
  const { data: categories } = useCategories();
  const addOrderItems = useAddOrderItems();
  const createOrder = useCreateOrder();
  // When adding to an existing order, the order type decides which channel
  // policy applies — takeout orders hide non-takeoutable items, delivery
  // orders hide non-deliverable items. New-order flows (tableId only) are
  // always dine-in, so no channel filter applies. The `enabled` gate
  // skips the fetch entirely for the new-order path — passing an empty
  // id otherwise pollutes Sentry with not-found errors.
  const { data: existingOrder } = useOrder(orderId || '', { enabled: !!orderId });
  const channelFilter = useMemo(
    () => (existingOrder ? deriveChannelFilter(existingOrder.order_type) : null),
    [existingOrder],
  );

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const cart = useOrderCart();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (categories?.length && selectedCategory === null) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);

  const filteredItems = useMemo(
    () =>
      applyMenuFilter({
        items: menuItems ?? [],
        selectedCategoryId: selectedCategory,
        channelFilter,
      }),
    [menuItems, selectedCategory, channelFilter],
  );

  const cartSummary = useMemo(
    () => ({ count: cart.count, total: cart.subtotal }),
    [cart.count, cart.subtotal],
  );

  const { cartItems, hasItems: hasCartItems, getQuantity, addItem, removeItem } = cart;

  const renderMenuItem = useCallback(
    ({ item }: { item: MenuItem }) => (
      <MenuItemCard
        menuItem={item}
        quantity={getQuantity(item.id)}
        currencySymbol={currencySymbol}
        onAdd={addItem}
        onRemove={removeItem}
      />
    ),
    [getQuantity, currencySymbol, addItem, removeItem],
  );

  const handleSubmit = async () => {
    const items = cartItems;
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
        menu_item_id: c.id,
        quantity: c.quantity,
        item_name: c.name,
        item_price: c.price,
        notes: null as string | null,
        status: ORDER_ITEM_STATUS.PENDING,
      }));

      await addOrderItems.mutateAsync(orderItems);
      showSuccess(isNewOrder ? t('orders.orderCreatedSuccess') : t('orders.itemsAddedToOrder'));
      navigation.goBack();
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('orders.failedAddItems'));
    } finally {
      setSubmitting(false);
    }
  };

  if (menuLoading) return <LoadingScreen message={t('orders.loadingMenu')} />;
  if (menuError) return <ErrorScreen error={menuError} onRetry={refetchMenu} />;

  const isLoading = submitting || addOrderItems.isPending;
  const footerHeight = 64 + insets.bottom;

  return (
    <View style={styles.container}>
      {/* Category tabs — horizontal scroll */}
      <View style={styles.categoryBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryBarContent}
        >
          {categories?.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setSelectedCategory(cat.id)}
              style={[
                styles.categoryChip,
                selectedCategory === cat.id && styles.categoryChipActive,
              ]}
            >
              <Text style={styles.categoryIcon}>{cat.icon || '📋'}</Text>
              <Text
                style={[
                  styles.categoryLabel,
                  selectedCategory === cat.id && styles.categoryLabelActive,
                ]}
                numberOfLines={1}
              >
                {cat.name || 'Category'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Menu items list */}
      <FlashList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderMenuItem}
        contentContainerStyle={{ paddingBottom: hasCartItems ? footerHeight + 8 : 16 }}
      />

      {/* Fixed footer — cart summary + submit */}
      {hasCartItems && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {/* Cart items mini-list */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.footerCartScroll}
            contentContainerStyle={styles.footerCartScrollContent}
          >
            {cartItems.map((item) => (
              <View key={item.id} style={styles.footerCartItem}>
                <Text style={styles.footerCartItemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.footerCartItemControls}>
                  <TouchableOpacity style={styles.footerQtyBtn} onPress={() => removeItem(item.id)}>
                    <Text style={styles.footerQtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.footerCartItemQty}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.footerQtyBtn}
                    onPress={() => addItem({ id: item.id, price: item.price, name: item.name })}
                  >
                    <Text style={styles.footerQtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Total + submit row */}
          <View style={styles.footerSubmitRow}>
            <View style={styles.footerInfo}>
              <View style={styles.footerBadge}>
                <Text style={styles.footerBadgeText}>{cartSummary.count}</Text>
              </View>
              <Text variant="titleSmall" style={styles.footerTotal}>
                {currencySymbol}
                {cartSummary.total.toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {isNewOrder ? t('orders.createOrder') : t('orders.addItems')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Category bar
  categoryBar: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: BRAND_PRIMARY,
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  categoryLabelActive: {
    color: '#fff',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  footerCartScroll: {
    maxHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  footerCartScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  footerCartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  footerCartItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    maxWidth: 80,
  },
  footerCartItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerQtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerQtyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    lineHeight: 16,
  },
  footerCartItemQty: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    minWidth: 16,
    textAlign: 'center',
  },
  footerSubmitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerBadge: {
    backgroundColor: COLORS.brandLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  footerBadgeText: {
    color: BRAND_PRIMARY,
    fontSize: 12,
    fontWeight: '700',
  },
  footerTotal: {
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  submitBtn: {
    backgroundColor: BRAND_PRIMARY,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
