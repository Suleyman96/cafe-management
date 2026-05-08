import { ACTIVE_ORDER_STATUSES } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import * as Sentry from '@sentry/react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TableCard } from '@/components/tables/TableCard';
import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import { useCurrencySymbol, useOrders, useTables, useWaiterCalls } from '@/hooks/local';
import { useCleanupEmptyOrders } from '@/hooks/shared';
import type { TablesStackParamList } from '@/types';

type Nav = StackNavigationProp<TablesStackParamList, 'TablesList'>;

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

  if (isLoading) return <LoadingScreen message={t('tables.loadingTables')} />;
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  list: {
    padding: 12,
  },
});
