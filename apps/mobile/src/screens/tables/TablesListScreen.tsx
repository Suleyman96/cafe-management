import { ACTIVE_ORDER_STATUSES } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { EmptyState, ErrorScreen, Skeleton } from '@gustri/ui-mobile';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import * as Sentry from '@sentry/react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TableCard } from '@/components/tables/TableCard';
import { useCurrencySymbol, useOrders, useTables, useWaiterCalls } from '@/hooks/local';
import { useCleanupEmptyOrders } from '@/hooks/shared';
import type { TablesStackParamList } from '@/types';

type Nav = StackNavigationProp<TablesStackParamList, 'TablesList'>;

/**
 * No FAB on this screen — table creation is an admin/org task currently
 * web-only on mobile. When mobile gains a table-create modal (parallel to
 * staff-web's `TableModal`, gated on the tenant plan's table cap), wire
 * a "+" FAB here behind the same `useCanPerform('manage_tables')`-style
 * check the web page uses. Until then, no half-shipped affordance.
 */
export default function TablesListScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation('staff');
  const insets = useSafeAreaInsets();
  const { data: tables, isLoading, isRefetching, error, refetch } = useTables();
  const { data: orders } = useOrders({
    statuses: ['pending_approval', 'new', 'preparing', 'ready', 'served'],
    limit: 200,
  });
  const { data: waiterCalls } = useWaiterCalls('pending');
  const currencySymbol = useCurrencySymbol();
  const cleanupEmptyOrders = useCleanupEmptyOrders();

  const handleTablePress = useCallback(
    (tableId: string) => navigation.navigate('TableDetail', { tableId }),
    [navigation],
  );

  // Cleanup stale empty orders on screen load (run once).
  const didCleanup = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: guarded by ref
  useEffect(() => {
    if (!didCleanup.current) {
      didCleanup.current = true;
      cleanupEmptyOrders.mutateAsync(undefined).catch((err) => {
        Sentry.captureException(err, { tags: { area: 'tables.cleanupEmptyOrders' } });
      });
    }
  }, []);

  // Pre-bucket active orders by table_id once per orders update so the per-table
  // join below is O(1) per table instead of O(orders) — visibly smoother during
  // realtime bursts on big floors.
  const orderAggregatesByTable = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    if (!orders) return map;
    for (const o of orders) {
      if (!o.table_id) continue;
      if (!(ACTIVE_ORDER_STATUSES as readonly string[]).includes(o.status)) continue;
      const agg = map.get(o.table_id);
      if (agg) {
        agg.count += 1;
        agg.total += o.total || 0;
      } else {
        map.set(o.table_id, { count: 1, total: o.total || 0 });
      }
    }
    return map;
  }, [orders]);

  const tablesWithCalls = useMemo(
    () => new Set((waiterCalls ?? []).map((c) => c.table_id).filter(Boolean) as string[]),
    [waiterCalls],
  );

  const tableData = useMemo(() => {
    if (!tables) return [];
    return tables.map((table) => {
      const agg = orderAggregatesByTable.get(table.id);
      return {
        table,
        activeOrderCount: agg?.count ?? 0,
        orderTotal: agg?.total ?? 0,
        hasWaiterCall: tablesWithCalls.has(table.id),
      };
    });
  }, [tables, orderAggregatesByTable, tablesWithCalls]);

  const renderTable = useCallback<ListRenderItem<(typeof tableData)[number]>>(
    ({ item }) => (
      <TableCard
        table={item.table}
        activeOrderCount={item.activeOrderCount}
        orderTotal={item.orderTotal}
        hasWaiterCall={item.hasWaiterCall}
        currencySymbol={currencySymbol}
        onPress={handleTablePress}
      />
    ),
    [currencySymbol, handleTablePress],
  );

  if (isLoading) return <TablesGridSkeleton />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <FlashList
        data={tableData}
        numColumns={2}
        keyExtractor={(item) => item.table.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        renderItem={renderTable}
        ListEmptyComponent={
          <EmptyState
            icon="table-furniture"
            title={t('tables.noTables')}
            description={t('tables.noTablesDescription')}
          />
        }
      />
    </View>
  );
}

function TablesGridSkeleton() {
  return (
    <View style={[styles.container, skeletonStyles.wrap]}>
      {Array.from({ length: 8 }).map((_, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton tiles have no identity
          key={i}
          style={skeletonStyles.tile}
        >
          <View style={skeletonStyles.card}>
            <Skeleton width="40%" height={22} />
            <Skeleton width="70%" height={12} />
            <Skeleton width="55%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  tile: { width: '50%', padding: 4 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 8,
    minHeight: 96,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  list: {
    padding: 12,
  },
});
