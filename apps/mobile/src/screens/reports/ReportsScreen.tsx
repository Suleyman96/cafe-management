import { useTranslation } from '@gustri/i18n';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Chip, Text } from 'react-native-paper';
import { MetricCard } from '@/components/reports/MetricCard';
import { LoadingScreen } from '@/components/ui';
import { useCurrencySymbol, useExpenses, useOrders, useStaff, useWasteLogs } from '@/hooks';
import { getLocalDateString } from '@/lib/date-utils';
import { aggregateReports } from '@/lib/reports-aggregate';
import { COLORS } from '@/theme';
import type { OrderWithDetails } from '@/types';

function getDateRange(preset: number): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = getLocalDateString(now);

  if (preset === -1) {
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
  const { t } = useTranslation('staff');
  const [presetIdx, setPresetIdx] = useState(2); // 30 Days

  const PRESETS = useMemo(
    () => [
      { label: t('reports.today'), days: 0 },
      { label: t('reports.7days'), days: 7 },
      { label: t('reports.30days'), days: 30 },
      { label: t('reports.thisMonth'), days: -1 },
    ],
    [t],
  );

  const range = getDateRange(PRESETS[presetIdx].days);

  const { data: orders, isLoading: loadingOrders } = useOrders({
    created_after: `${range.startDate}T00:00:00`,
    created_before: `${range.endDate}T23:59:59`,
  });
  const { data: staffList } = useStaff();
  const { data: expenses } = useExpenses({ startDate: range.startDate, endDate: range.endDate });
  const { data: wasteLogs } = useWasteLogs({ startDate: range.startDate, endDate: range.endDate });
  const currencySymbol = useCurrencySymbol();

  const filteredOrders = (orders || []) as OrderWithDetails[];

  // Single aggregation pass replaces four separate memos. Same render still
  // reads `metrics`, `orderTypes`, `topItems`, `staffPerformance` — they're
  // now slices of one shared aggregate so we walk `filteredOrders` exactly
  // once per data change.
  const unknownLabel = t('kitchen.unknownItem');
  const report = useMemo(
    () => aggregateReports(filteredOrders, staffList, unknownLabel),
    [filteredOrders, staffList, unknownLabel],
  );
  const metrics = report.totals;
  const orderTypes = report.byType;
  const topItems = report.topItems;
  const staffPerformance = report.byStaff;

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

  if (loadingOrders) return <LoadingScreen message={t('reports.loadingReports')} />;

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
        {t('reports.keyMetrics')}
      </Text>
      <View style={styles.metricsGrid}>
        <MetricCard
          label={t('reports.revenue')}
          value={`${currencySymbol}${metrics.revenue.toFixed(0)}`}
          color={COLORS.success}
        />
        <MetricCard label={t('reports.ordersHandled')} value={metrics.orderCount} />
        <MetricCard
          label={t('reports.avgOrderShort')}
          value={`${currencySymbol}${metrics.avgOrderValue.toFixed(2)}`}
        />
        <MetricCard
          label={t('reports.completion')}
          value={`${metrics.completionRate.toFixed(0)}%`}
          color={metrics.completionRate > 80 ? COLORS.success : COLORS.warning}
        />
      </View>

      {/* Order Types */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        {t('reports.orderTypes')}
      </Text>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.typeRow}>
            <Text variant="bodyMedium">{t('reports.dineIn')}</Text>
            <Text variant="titleSmall" style={{ fontWeight: '700' }}>
              {orderTypes.dine_in}
            </Text>
          </View>
          <View style={styles.typeRow}>
            <Text variant="bodyMedium">{t('reports.takeout')}</Text>
            <Text variant="titleSmall" style={{ fontWeight: '700' }}>
              {orderTypes.takeout}
            </Text>
          </View>
          <View style={styles.typeRow}>
            <Text variant="bodyMedium">{t('reports.delivery')}</Text>
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
            {t('reports.soldItems')}
          </Text>
          <Card style={styles.card}>
            <Card.Content>
              {topItems.map((item, i) => (
                <View key={item.name} style={styles.rankRow}>
                  <Text variant="bodyMedium" style={{ flex: 1 }}>
                    {i + 1}. {item.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.muted}>
                    {item.qty} {t('reports.sold')}
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
            {t('reports.staffPerformance')}
          </Text>
          <Card style={styles.card}>
            <Card.Content>
              {staffPerformance.map((s, i) => (
                <View key={s.name} style={styles.rankRow}>
                  <Text variant="bodyMedium" style={{ flex: 1 }}>
                    {i + 1}. {s.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.muted}>
                    {s.orders} {t('reports.orders')}
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
        {t('reports.expensesAndWaste')}
      </Text>
      <View style={styles.metricsGrid}>
        <MetricCard
          label={t('reports.expenses')}
          value={`${currencySymbol}${expenseTotal.toFixed(0)}`}
          color={COLORS.danger}
          subtitle={`${expenses?.length || 0} ${t('reports.transactions')}`}
        />
        <MetricCard
          label={t('reports.wasteSummary')}
          value={`${currencySymbol}${wasteTotal.toFixed(0)}`}
          color={COLORS.warning}
          subtitle={`${wasteLogs?.length || 0} ${t('reports.entries')}`}
        />
      </View>

      {/* Profit */}
      <Card style={[styles.card, { marginBottom: 32 }]}>
        <Card.Content>
          <View style={styles.typeRow}>
            <Text variant="titleMedium" style={{ fontWeight: '700' }}>
              {t('reports.netProfit')}
            </Text>
            <Text
              variant="titleLarge"
              style={{
                fontWeight: '700',
                color: metrics.revenue - expenseTotal >= 0 ? COLORS.success : COLORS.danger,
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
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, gap: 8 },
  presetRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  sectionTitle: { fontWeight: '700', color: COLORS.textPrimary, marginTop: 8 },
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
    borderBottomColor: COLORS.borderLight,
  },
  muted: { color: COLORS.textMuted },
});
