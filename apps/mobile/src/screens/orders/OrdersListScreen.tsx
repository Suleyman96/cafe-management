import { ORDER_STATUS_KEYS } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { EmptyState, ErrorScreen, FilterChipBar, Skeleton } from '@gustri/ui-mobile';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { OrderCard } from '@/components/orders/OrderCard';
import { useCurrencySymbol, useOrders } from '@/hooks/local';
import { BRAND_PRIMARY, COLORS, ORDER_STATUS_COLORS } from '@/theme';
import type { Order, OrderItemWithMenuItem, OrdersStackParamList } from '@/types';

// 30 days back covers the recent-orders view (active + recently closed).
// Older orders need a dedicated history screen with infinite pagination —
// keeping this list bounded prevents the silent cap that hid older rows.
const RECENT_WINDOW_DAYS = 30;
function startOfRecentWindow(): string {
  const d = new Date();
  d.setDate(d.getDate() - RECENT_WINDOW_DAYS);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

type Nav = StackNavigationProp<OrdersStackParamList, 'OrdersList'>;

type OrderWithJoins = Order & {
  table?: { table_number: string; location: string | null };
  order_items?: OrderItemWithMenuItem[];
  assigned_waiter?: { full_name: string } | null;
};

const STATUS_FILTERS = [
  'all',
  'pending_approval',
  'new',
  'preparing',
  'ready',
  'served',
  'out_for_delivery',
  'delivered',
  'closed',
  'cancelled',
] as const;

/**
 * No FAB on this screen — order creation is intentionally contextual on
 * mobile, not routed through a generic "+" affordance. Dine-in orders
 * start when a waiter taps a table from `TablesListScreen`; takeout and
 * delivery have their own dedicated FABs on `TakeoutListScreen` /
 * `DeliveryListScreen`. A "+ new order" button here would have nowhere
 * to send the user without first asking the order_type — defeating the
 * speed the FAB is meant to provide.
 */
export default function OrdersListScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const createdAfter = useMemo(() => startOfRecentWindow(), []);
  const {
    data: orders,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useOrders({
    created_after: createdAfter,
  });
  const currencySymbol = useCurrencySymbol();

  const handleOrderPress = useCallback(
    (orderId: string) => navigation.navigate('OrderDetail', { orderId }),
    [navigation],
  );

  const renderOrder = useCallback<ListRenderItem<OrderWithJoins>>(
    ({ item }) => (
      <OrderCard order={item} currencySymbol={currencySymbol} onPress={handleOrderPress} />
    ),
    [currencySymbol, handleOrderPress],
  );

  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filterOptions = useMemo(
    () =>
      STATUS_FILTERS.map((s) => ({
        key: s,
        label: s === 'all' ? tCommon('all') : t(ORDER_STATUS_KEYS[s] || s),
        color: s === 'all' ? BRAND_PRIMARY : ORDER_STATUS_COLORS[s]?.text || BRAND_PRIMARY,
      })),
    [t, tCommon],
  );

  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    let filtered = orders as OrderWithJoins[];

    if (selectedStatus !== 'all') {
      filtered = filtered.filter((o) => o.status === selectedStatus);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.order_number?.toString().includes(q) || o.table?.table_number?.toString().includes(q),
      );
    }

    return filtered;
  }, [orders, selectedStatus, search]);

  if (isLoading) return <OrdersListSkeleton />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          placeholder={t('orders.searchByOrderNumber')}
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          placeholderTextColor={COLORS.textLight}
          accessibilityLabel={t('orders.searchByOrderNumber')}
        />
      </View>

      {/* Status filter chips */}
      <FilterChipBar
        options={filterOptions}
        selected={selectedStatus}
        onSelect={setSelectedStatus}
      />

      <FlashList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        renderItem={renderOrder}
        ListEmptyComponent={
          <EmptyState
            icon="clipboard-text-off"
            title={t('orders.noOrders')}
            description={
              selectedStatus === 'all'
                ? t('orders.noOrdersYet')
                : t('orders.noOrdersWithStatus', {
                    status:
                      selectedStatus === 'all'
                        ? ''
                        : t(ORDER_STATUS_KEYS[selectedStatus] || selectedStatus),
                  })
            }
          />
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

function OrdersListSkeleton() {
  return (
    <View style={[styles.container, skeletonStyles.wrap]}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows have no identity
          key={i}
          style={skeletonStyles.row}
        >
          <View style={skeletonStyles.headRow}>
            <Skeleton width={80} height={18} />
            <Skeleton width={64} height={20} radius={9999} />
          </View>
          <Skeleton width="70%" height={14} />
          <Skeleton width="40%" height={14} />
        </View>
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  row: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchContainer: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  list: {
    paddingTop: 4,
    paddingBottom: 100,
  },
});
