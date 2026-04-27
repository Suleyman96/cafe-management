import { useTranslation } from '@gustri/i18n';
import { FlashList } from '@shopify/flash-list';
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, FAB, Modal, Portal, Text } from 'react-native-paper';
import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import { WasteLogCard } from '@/components/waste/WasteLogCard';
import {
  useCreateWasteLog,
  useCurrencySymbol,
  useDeleteWasteLog,
  useWasteLogs,
  useWasteMonthlySummary,
} from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { getLocalDateString } from '@/lib/date-utils';
import { TextInput } from '@/lib/paper-compat';
import { useAuthStore } from '@/store/auth-store';
import { COLORS } from '@/theme';
import type { WasteLog } from '@/types';

const REASONS: WasteLog['reason'][] = [
  'expired',
  'spoiled',
  'overcooked',
  'dropped',
  'returned_by_customer',
  'preparation_waste',
  'other',
];

const REASON_KEYS: Record<string, string> = {
  expired: 'waste.expired',
  spoiled: 'waste.spoiled',
  overcooked: 'waste.overcooked',
  dropped: 'waste.dropped',
  returned_by_customer: 'waste.returnedByCustomer',
  preparation_waste: 'waste.preparationWaste',
  other: 'waste.other',
};

export default function WasteListScreen() {
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [reasonFilter, setReasonFilter] = useState<string | undefined>();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

  const {
    data: logs,
    isLoading,
    error,
    refetch,
  } = useWasteLogs({ startDate, endDate, reason: reasonFilter });
  const { data: summary } = useWasteMonthlySummary(year, month);
  const createWaste = useCreateWasteLog();
  const deleteWaste = useDeleteWasteLog();

  const currencySymbol = useCurrencySymbol();

  // Create modal state
  const [newItem, setNewItem] = useState<{
    item_name: string;
    quantity: string;
    unit: string;
    cost: string;
    reason: WasteLog['reason'];
    notes: string;
  }>({
    item_name: '',
    quantity: '',
    unit: 'pcs',
    cost: '',
    reason: 'other',
    notes: '',
  });

  const handleCreate = async () => {
    if (!newItem.item_name.trim()) {
      showError(`${t('waste.itemName')} — ${tCommon('required')}`);
      return;
    }
    try {
      const qty = parseFloat(newItem.quantity) || 0;
      const costPerUnit = parseFloat(newItem.cost) || 0;
      await createWaste.mutateAsync({
        item_name: newItem.item_name.trim(),
        category: '',
        quantity: qty,
        unit: newItem.unit,
        cost_per_unit: costPerUnit,
        total_cost: costPerUnit * qty,
        reason: newItem.reason,
        notes: newItem.notes || null,
        logged_by: staff?.id ?? null,
        waste_date: getLocalDateString(),
        stock_item_id: null,
      });
      showSuccess(t('waste.wasteLogged'));
      setShowCreateModal(false);
      setNewItem({
        item_name: '',
        quantity: '',
        unit: 'pcs',
        cost: '',
        reason: 'other',
        notes: '',
      });
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('waste.failedLog'));
    }
  };

  const _handleDelete = async (id: string) => {
    try {
      await deleteWaste.mutateAsync(id);
      showSuccess(t('waste.wasteLogDeleted'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('waste.failedDelete'));
    }
  };

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else setMonth(month - 1);
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else setMonth(month + 1);
  };

  if (isLoading) return <LoadingScreen message={t('waste.loadingWaste')} />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <Button compact onPress={handlePrevMonth}>
          {t('expenses.prev')}
        </Button>
        <Text variant="titleMedium" style={styles.monthLabel}>
          {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
        </Text>
        <Button compact onPress={handleNextMonth}>
          {t('expenses.next')}
        </Button>
      </View>

      {/* Summary */}
      {summary && (
        <View style={styles.summaryRow}>
          <Card style={styles.summaryCard}>
            <Card.Content>
              <Text variant="bodySmall" style={styles.muted}>
                {t('waste.totalCost')}
              </Text>
              <Text variant="titleMedium" style={{ fontWeight: '700', color: COLORS.danger }}>
                {currencySymbol}
                {(summary.totalCost || 0).toFixed(2)}
              </Text>
            </Card.Content>
          </Card>
          <Card style={styles.summaryCard}>
            <Card.Content>
              <Text variant="bodySmall" style={styles.muted}>
                {t('waste.wasteEvents')}
              </Text>
              <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                {summary.count || 0}
              </Text>
            </Card.Content>
          </Card>
        </View>
      )}

      {/* Reason Filter */}
      <View style={styles.filterRow}>
        <Chip
          compact
          selected={!reasonFilter}
          onPress={() => setReasonFilter(undefined)}
          style={styles.filterChip}
        >
          {tCommon('all')}
        </Chip>
        {REASONS.map((r) => (
          <Chip
            key={r}
            compact
            selected={reasonFilter === r}
            onPress={() => setReasonFilter(reasonFilter === r ? undefined : r)}
            style={styles.filterChip}
          >
            {t(REASON_KEYS[r] || r)}
          </Chip>
        ))}
      </View>

      <FlashList
        data={logs || []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => <WasteLogCard log={item} currencySymbol={currencySymbol} />}
        ListEmptyComponent={
          <EmptyState
            icon="delete-off"
            title={t('waste.noWasteLogs')}
            description={t('waste.noWasteDescription')}
          />
        }
        contentContainerStyle={styles.list}
      />

      <FAB icon="plus" style={styles.fab} onPress={() => setShowCreateModal(true)} />

      {/* Create Modal */}
      <Portal>
        <Modal
          visible={showCreateModal}
          onDismiss={() => setShowCreateModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 12 }}>
            {t('waste.addWasteLog')}
          </Text>
          <TextInput
            label={t('waste.itemName')}
            value={newItem.item_name}
            onChangeText={(v: string) => setNewItem({ ...newItem, item_name: v })}
            mode="outlined"
            dense
            style={styles.input}
          />
          <TextInput
            label={tCommon('quantity')}
            value={newItem.quantity}
            onChangeText={(v: string) => setNewItem({ ...newItem, quantity: v })}
            mode="outlined"
            keyboardType="decimal-pad"
            dense
            style={styles.input}
          />
          <TextInput
            label={t('stock.unit')}
            value={newItem.unit}
            onChangeText={(v: string) => setNewItem({ ...newItem, unit: v })}
            mode="outlined"
            dense
            style={styles.input}
          />
          <TextInput
            label={t('waste.costPerUnit')}
            value={newItem.cost}
            onChangeText={(v: string) => setNewItem({ ...newItem, cost: v })}
            mode="outlined"
            keyboardType="decimal-pad"
            left={<TextInput.Affix text={currencySymbol} />}
            dense
            style={styles.input}
          />
          <View style={styles.reasonPicker}>
            {REASONS.map((r) => (
              <Chip
                key={r}
                compact
                selected={newItem.reason === r}
                onPress={() => setNewItem({ ...newItem, reason: r })}
                style={styles.filterChip}
              >
                {t(REASON_KEYS[r] || r)}
              </Chip>
            ))}
          </View>
          <TextInput
            label={`${tCommon('notes')} (${tCommon('optional')})`}
            value={newItem.notes}
            onChangeText={(v: string) => setNewItem({ ...newItem, notes: v })}
            mode="outlined"
            multiline
            dense
            style={styles.input}
          />
          <View style={styles.modalActions}>
            <Button onPress={() => setShowCreateModal(false)}>{tCommon('cancel')}</Button>
            <Button mode="contained" onPress={handleCreate} loading={createWaste.isPending}>
              {tCommon('save')}
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  monthLabel: { fontWeight: '600' },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  summaryCard: { flex: 1 },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 8,
  },
  filterChip: {},
  list: { paddingTop: 4, paddingBottom: 80 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  modal: { backgroundColor: COLORS.card, margin: 20, padding: 20, borderRadius: 12 },
  input: { marginBottom: 8 },
  reasonPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  muted: { color: COLORS.textMuted },
});
