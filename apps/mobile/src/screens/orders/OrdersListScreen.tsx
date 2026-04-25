import { ORDER_STATUS_KEYS } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { OrderCard } from '@/components/orders/OrderCard';
import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import { useCurrencySymbol, useOrders } from '@/hooks';
import { Text } from '@/lib/paper-compat';
import { BRAND_PRIMARY, COLORS, ORDER_STATUS_COLORS } from '@/theme';
import type { Order, OrderItemWithMenuItem, OrdersStackParamList } from '@/types';

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

export default function OrdersListScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const { data: orders, isLoading, error, refetch } = useOrders();
  const currencySymbol = useCurrencySymbol();

  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

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

  if (isLoading) return <LoadingScreen message={t('orders.loadingOrders')} />;
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
        />
      </View>

      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
      >
        {STATUS_FILTERS.map((s) => {
          const isSelected = selectedStatus === s;
          const chipColor = s === 'all' ? BRAND_PRIMARY : ORDER_STATUS_COLORS[s] || BRAND_PRIMARY;

          return (
            <TouchableOpacity
              key={s}
              onPress={() => setSelectedStatus(s)}
              style={[styles.filterChip, isSelected && { backgroundColor: chipColor }]}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}
                numberOfLines={1}
              >
                {s === 'all' ? tCommon('all') : t(ORDER_STATUS_KEYS[s] || s)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlashList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            currencySymbol={currencySymbol}
            onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
          />
        )}
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
  filterRow: {
    maxHeight: 52,
  },
  filterRowContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    backgroundColor: COLORS.borderLight,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  list: {
    paddingTop: 4,
    paddingBottom: 100,
  },
});
