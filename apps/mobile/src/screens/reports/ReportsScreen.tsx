import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Chip, Text } from 'react-native-paper';
import { MetricCard } from '@/components/reports/MetricCard';
import { LoadingScreen } from '@/components/ui';
import { useExpenses, useOrders, useStaff, useWasteLogs } from '@/hooks';
import { useCafeSettings } from '@/hooks/use-cafe-settings';
import { getLocalDateString } from '@/lib/date-utils';
import type { Order, OrderItemWithMenuItem } from '@/types';

// The wrapper's findAll returns joined data beyond the base Order type
type OrderWithJoins = Order & {
  table?: { table_number: string; location: string | null };
  order_items?: OrderItemWithMenuItem[];
  assigned_waiter?: { full_name: string } | null;
};

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: 'This Month', days: -1 },
];

function getDateRange(preset: number): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = getLocalDateString(now);

  if (preset === -1) {
    // This month
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: getLocalDateString(start), endDate };
  }

  if (preset === 0) {
    return { startDate: endDate, endDate };
  }

  const start = new Date(now);
  start.setDate(start.getDate() - preset);
  return { startDate: getLocalDateString(start), endDate };
}

export default function ReportsScreen() {
  const [presetIdx, setPresetIdx] = useState(2); // 30 Days
  const range = getDateRange(PRESETS[presetIdx].days);

  const { data: orders, isLoading: loadingOrders } = useOrders();
  const { data: staffList } = useStaff();
  const { data: expenses } = useExpenses({ startDate: range.startDate, endDate: range.endDate });
  const { data: wasteLogs } = useWasteLogs({ startDate: range.startDate, endDate: range.endDate });
  const { data: settings } = useCafeSettings();

  const currencySymbol = settings?.currency_symbol || '$';

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    if (!orders) return [] as OrderWithJoins[];
    return (orders as OrderWithJoins[]).filter((o) => {
      const created = o.created_at?.split('T')[0];
      return created >= range.startDate && created <= range.endDate;
    });
  }, [orders, range.startDate, range.endDate]);

  // Key metrics
  const metrics = useMemo(() => {
    const paidOrders = filteredOrders.filter((o) => o.status === 'closed' || o.status === 'served');
    const revenue = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const orderCount = filteredOrders.length;
    const avgOrderValue = orderCount > 0 ? revenue / paidOrders.length : 0;
    const completedCount = paidOrders.length;
    const completionRate = orderCount > 0 ? (completedCount / orderCount) * 100 : 0;

    return { revenue, orderCount, avgOrderValue, completionRate };
  }, [filteredOrders]);

  // Order types
  const orderTypes = useMemo(() => {
    const types = { dine_in: 0, takeaway: 0, delivery: 0 };
    filteredOrders.forEach((o) => {
      const t = o.order_type || 'dine_in';
      if (t in types) types[t as keyof typeof types]++;
    });
    return types;
  }, [filteredOrders]);

  // Top sold items
  const topItems = useMemo(() => {
    const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    filteredOrders.forEach((o) => {
      (o.order_items || []).forEach((item: OrderItemWithMenuItem) => {
        const name = item.menu_item?.name || 'Unknown';
        if (!itemMap[name]) itemMap[name] = { name, qty: 0, revenue: 0 };
        itemMap[name].qty += item.quantity || 0;
        itemMap[name].revenue += (item.item_price || 0) * (item.quantity || 0);
      });
    });
    return Object.values(itemMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [filteredOrders]);

  // Staff performance
  const staffPerformance = useMemo(() => {
    if (!staffList) return [];
    const perf: Record<string, { name: string; orders: number; revenue: number }> = {};
    filteredOrders.forEach((o) => {
      const wId = o.assigned_waiter_id;
      if (!wId) return;
      const s = staffList.find((st) => st.id === wId);
      if (!perf[wId]) perf[wId] = { name: s?.full_name || 'Unknown', orders: 0, revenue: 0 };
      perf[wId].orders++;
      perf[wId].revenue += o.total || 0;
    });
    return Object.values(perf)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filteredOrders, staffList]);

  // Expense total
  const expenseTotal = useMemo(() => {
    return expenses?.reduce((sum: number, e: { amount: number }) => sum + (e.amount || 0), 0) || 0;
  }, [expenses]);

  // Waste total
  const wasteTotal = useMemo(() => {
    return (
      wasteLogs?.reduce((sum: number, w: { total_cost: number }) => sum + (w.total_cost || 0), 0) ||
      0
    );
  }, [wasteLogs]);

  if (loadingOrders) return <LoadingScreen message="Loading reports..." />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Date Range Selector */}
      <View style={styles.presetRow}>
        {PRESETS.map((p, i) => (
          <Chip key={p.label} compact selected={presetIdx === i} onPress={() => setPresetIdx(i)}>
            {p.label}
          </Chip>
        ))}
      </View>

      {/* Key Metrics */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Key Metrics
      </Text>
      <View style={styles.metricsGrid}>
        <MetricCard
          label="Revenue"
          value={`${currencySymbol}${metrics.revenue.toFixed(0)}`}
          color="#10b981"
        />
        <MetricCard label="Orders" value={metrics.orderCount} />
        <MetricCard
          label="Avg Order"
          value={`${currencySymbol}${metrics.avgOrderValue.toFixed(2)}`}
        />
        <MetricCard
          label="Completion"
          value={`${metrics.completionRate.toFixed(0)}%`}
          color={metrics.completionRate > 80 ? '#10b981' : '#f59e0b'}
        />
      </View>

      {/* Order Types */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Order Types
      </Text>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.typeRow}>
            <Text variant="bodyMedium">Dine-in</Text>
            <Text variant="titleSmall" style={{ fontWeight: '700' }}>
              {orderTypes.dine_in}
            </Text>
          </View>
          <View style={styles.typeRow}>
            <Text variant="bodyMedium">Takeout</Text>
            <Text variant="titleSmall" style={{ fontWeight: '700' }}>
              {orderTypes.takeaway}
            </Text>
          </View>
          <View style={styles.typeRow}>
            <Text variant="bodyMedium">Delivery</Text>
            <Text variant="titleSmall" style={{ fontWeight: '700' }}>
              {orderTypes.delivery}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Top Sold Items */}
      {topItems.length > 0 && (
        <>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Top Sold Items
          </Text>
          <Card style={styles.card}>
            <Card.Content>
              {topItems.map((item, i) => (
                <View key={item.name} style={styles.rankRow}>
                  <Text variant="bodyMedium" style={{ flex: 1 }}>
                    {i + 1}. {item.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.muted}>
                    {item.qty} sold
                  </Text>
                  <Text variant="bodySmall" style={{ fontWeight: '600', marginLeft: 8 }}>
                    {currencySymbol}
                    {item.revenue.toFixed(0)}
                  </Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        </>
      )}

      {/* Staff Performance */}
      {staffPerformance.length > 0 && (
        <>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Staff Performance
          </Text>
          <Card style={styles.card}>
            <Card.Content>
              {staffPerformance.map((s, i) => (
                <View key={s.name} style={styles.rankRow}>
                  <Text variant="bodyMedium" style={{ flex: 1 }}>
                    {i + 1}. {s.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.muted}>
                    {s.orders} orders
                  </Text>
                  <Text variant="bodySmall" style={{ fontWeight: '600', marginLeft: 8 }}>
                    {currencySymbol}
                    {s.revenue.toFixed(0)}
                  </Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        </>
      )}

      {/* Expense & Waste Summary */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Expenses & Waste
      </Text>
      <View style={styles.metricsGrid}>
        <MetricCard
          label="Expenses"
          value={`${currencySymbol}${expenseTotal.toFixed(0)}`}
          color="#ef4444"
          subtitle={`${expenses?.length || 0} transactions`}
        />
        <MetricCard
          label="Waste"
          value={`${currencySymbol}${wasteTotal.toFixed(0)}`}
          color="#f59e0b"
          subtitle={`${wasteLogs?.length || 0} entries`}
        />
      </View>

      {/* Profit */}
      <Card style={[styles.card, { marginBottom: 32 }]}>
        <Card.Content>
          <View style={styles.typeRow}>
            <Text variant="titleMedium" style={{ fontWeight: '700' }}>
              Net Profit
            </Text>
            <Text
              variant="titleLarge"
              style={{
                fontWeight: '700',
                color: metrics.revenue - expenseTotal >= 0 ? '#10b981' : '#ef4444',
              }}
            >
              {currencySymbol}
              {(metrics.revenue - expenseTotal).toFixed(0)}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 8 },
  presetRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  sectionTitle: { fontWeight: '700', color: '#1e293b', marginTop: 8 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {},
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  muted: { color: '#6b7280' },
});
