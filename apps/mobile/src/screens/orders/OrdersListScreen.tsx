import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Chip, Searchbar } from 'react-native-paper';
import { OrderCard } from '@/components/orders/OrderCard';
import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import { useOrders } from '@/hooks';
import { ORDER_STATUS_COLORS } from '@/theme';
import type { OrdersStackParamList } from '@/types';

type Nav = StackNavigationProp<OrdersStackParamList, 'OrdersList'>;

const STATUS_FILTERS = ['all', 'new', 'preparing', 'ready', 'served', 'paid', 'cancelled'] as const;

export default function OrdersListScreen() {
  const navigation = useNavigation<Nav>();
  const { data: orders, isLoading, error, refetch } = useOrders();

  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    let filtered = orders;

    if (selectedStatus !== 'all') {
      filtered = filtered.filter((o) => o.status === selectedStatus);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.order_number?.toString().includes(q) ||
          (o as any).table?.table_number?.toString().includes(q),
      );
    }

    return filtered;
  }, [orders, selectedStatus, search]);

  if (isLoading) return <LoadingScreen message="Loading orders..." />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search by order #"
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
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </Chip>
        ))}
      </ScrollView>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="clipboard-text-off"
            title="No orders"
            description={selectedStatus === 'all' ? 'No orders yet' : `No ${selectedStatus} orders`}
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
