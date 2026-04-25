import { ORDER_STATUS_KEYS } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Chip, Searchbar } from 'react-native-paper';
import { OrderCard } from '@/components/orders/OrderCard';
import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import { useCurrencySymbol, useOrders } from '@/hooks';
import { ORDER_STATUS_COLORS } from '@/theme';
import type { Order, OrderItemWithMenuItem, OrdersStackParamList } from '@/types';

type Nav = StackNavigationProp<OrdersStackParamList, 'OrdersList'>;

// The wrapper's findAll returns joined data beyond the base Order type
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
      <Searchbar
        placeholder={t('orders.searchByOrderNumber')}
        value={search}
        onChangeText={setSearch}
        style={styles.searchbar}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {STATUS_FILTERS.map((s) => (
          <Chip
            key={s}
            selected={selectedStatus === s}
            onPress={() => setSelectedStatus(s)}
            style={[
              styles.filterChip,
              selectedStatus === s && {
                backgroundColor: s === 'all' ? '#2563eb' : ORDER_STATUS_COLORS[s] || '#2563eb',
              },
            ]}
            textStyle={selectedStatus === s ? { color: '#fff' } : undefined}
            compact
          >
            {s === 'all' ? tCommon('all') : t(ORDER_STATUS_KEYS[s] || s)}
          </Chip>
        ))}
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
    backgroundColor: '#f8fafc',
  },
  searchbar: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  filterRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 52,
  },
  filterChip: {
    marginHorizontal: 4,
  },
  list: {
    paddingTop: 4,
    paddingBottom: 100,
  },
});
