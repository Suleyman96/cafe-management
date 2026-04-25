import { ACTIVE_ORDER_STATUSES } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { FlashList } from '@shopify/flash-list';
import { useEffect, useMemo, useRef } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TableCard } from '@/components/tables/TableCard';
import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import {
  useCleanupEmptyOrders,
  useCurrencySymbol,
  useOrders,
  useTables,
  useWaiterCalls,
} from '@/hooks';
import type { TablesStackParamList } from '@/types';

type Nav = StackNavigationProp<TablesStackParamList, 'TablesList'>;

export default function TablesListScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation('staff');
  const insets = useSafeAreaInsets();
  const { data: tables, isLoading, error, refetch } = useTables();
  const { data: orders } = useOrders({
    statuses: ['pending_approval', 'new', 'preparing', 'ready', 'served'],
  });
  const { data: waiterCalls } = useWaiterCalls('pending');
  const currencySymbol = useCurrencySymbol();
  const cleanupEmptyOrders = useCleanupEmptyOrders();

  // Cleanup stale empty orders on screen load (run once)
  const didCleanup = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire-and-forget, guarded by ref
  useEffect(() => {
    if (!didCleanup.current) {
      didCleanup.current = true;
      cleanupEmptyOrders.mutate(undefined);
    }
  }, []);

  const tableData = useMemo(() => {
    if (!tables) return [];

    return tables.map((table) => {
      const activeOrders =
        orders?.filter(
          (o) =>
            o.table_id === table.id &&
            (ACTIVE_ORDER_STATUSES as readonly string[]).includes(o.status),
        ) || [];

      const orderTotal = activeOrders.reduce((sum, o) => sum + (o.total || 0), 0);

      const hasWaiterCall = waiterCalls?.some((c) => c.table_id === table.id) || false;

      return {
        table,
        activeOrderCount: activeOrders.length,
        orderTotal,
        hasWaiterCall,
      };
    });
  }, [tables, orders, waiterCalls]);

  if (isLoading) return <LoadingScreen message={t('tables.loadingTables')} />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <FlashList
        data={tableData}
        estimatedItemSize={120}
        numColumns={2}
        keyExtractor={(item) => item.table.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <TableCard
            table={item.table}
            activeOrderCount={item.activeOrderCount}
            orderTotal={item.orderTotal}
            hasWaiterCall={item.hasWaiterCall}
            currencySymbol={currencySymbol}
            onPress={() => navigation.navigate('TableDetail', { tableId: item.table.id })}
          />
        )}
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
