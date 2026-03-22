import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, FAB, Modal, Portal, Text } from 'react-native-paper';
import { ExpenseCard } from '@/components/expenses/ExpenseCard';
import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import {
  useCafeSettings,
  useCreateExpense,
  useDeleteExpense,
  useExpenseCategories,
  useExpenseMonthlySummary,
  useExpenses,
} from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { TextInput } from '@/lib/paper-compat';
import { useAuthStore } from '@/store/auth-store';
import type { Expense } from '@/types';

const PAYMENT_METHODS: Expense['payment_method'][] = ['cash', 'card', 'digital', 'bank_transfer'];

export default function ExpensesListScreen() {
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [methodFilter, setMethodFilter] = useState<string | undefined>();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

  const {
    data: expenses,
    isLoading,
    error,
    refetch,
  } = useExpenses({ startDate, endDate, paymentMethod: methodFilter });
  const { data: summary } = useExpenseMonthlySummary(year, month);
  const { data: categories } = useExpenseCategories();
  const { data: settings } = useCafeSettings();
  const createExpense = useCreateExpense();
  const _deleteExpense = useDeleteExpense();

  const currencySymbol = settings?.currency_symbol || '$';

  const [newExpense, setNewExpense] = useState<{
    description: string;
    amount: string;
    payment_method: Expense['payment_method'];
    category_id: string;
  }>({
    description: '',
    amount: '',
    payment_method: 'cash',
    category_id: '',
  });

  const handleCreate = async () => {
    const amount = parseFloat(newExpense.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      showError('Enter a valid amount');
      return;
    }
    try {
      await createExpense.mutateAsync({
        description: newExpense.description,
        amount,
        payment_method: newExpense.payment_method,
        category_id: newExpense.category_id || null,
        created_by: staff?.id ?? null,
        expense_date: new Date().toISOString().split('T')[0],
        receipt_url: null,
        notes: null,
      });
      showSuccess('Expense recorded');
      setShowCreateModal(false);
      setNewExpense({ description: '', amount: '', payment_method: 'cash', category_id: '' });
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to create expense');
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

  if (isLoading) return <LoadingScreen message="Loading expenses..." />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <Button compact onPress={handlePrevMonth}>
          Prev
        </Button>
        <Text variant="titleMedium" style={styles.monthLabel}>
          {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
        </Text>
        <Button compact onPress={handleNextMonth}>
          Next
        </Button>
      </View>

      {/* Summary */}
      {summary && (
        <View style={styles.summaryRow}>
          <Card style={styles.summaryCard}>
            <Card.Content>
              <Text variant="bodySmall" style={styles.muted}>
                Total
              </Text>
              <Text variant="titleMedium" style={{ fontWeight: '700', color: '#ef4444' }}>
                {currencySymbol}
                {(summary.total || 0).toFixed(2)}
              </Text>
            </Card.Content>
          </Card>
          <Card style={styles.summaryCard}>
            <Card.Content>
              <Text variant="bodySmall" style={styles.muted}>
                Transactions
              </Text>
              <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                {summary.count || 0}
              </Text>
            </Card.Content>
          </Card>
        </View>
      )}

      {/* Payment Method Filter */}
      <View style={styles.filterRow}>
        <Chip compact selected={!methodFilter} onPress={() => setMethodFilter(undefined)}>
          All
        </Chip>
        {PAYMENT_METHODS.map((m) => (
          <Chip
            key={m}
            compact
            selected={methodFilter === m}
            onPress={() => setMethodFilter(methodFilter === m ? undefined : m)}
          >
            {m.replace(/_/g, ' ')}
          </Chip>
        ))}
      </View>

      <FlatList
        data={expenses || []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => <ExpenseCard expense={item} currencySymbol={currencySymbol} />}
        ListEmptyComponent={
          <EmptyState
            icon="cash-off"
            title="No expenses"
            description="No expenses recorded this month"
          />
        }
        contentContainerStyle={styles.list}
      />

      <FAB icon="plus" style={styles.fab} onPress={() => setShowCreateModal(true)} />

      <Portal>
        <Modal
          visible={showCreateModal}
          onDismiss={() => setShowCreateModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 12 }}>
            New Expense
          </Text>
          <TextInput
            label="Description"
            value={newExpense.description}
            onChangeText={(v: string) => setNewExpense({ ...newExpense, description: v })}
            mode="outlined"
            dense
            style={styles.input}
          />
          <TextInput
            label="Amount"
            value={newExpense.amount}
            onChangeText={(v: string) => setNewExpense({ ...newExpense, amount: v })}
            mode="outlined"
            keyboardType="decimal-pad"
            left={<TextInput.Affix text={currencySymbol} />}
            dense
            style={styles.input}
          />
          <Text variant="bodySmall" style={[styles.muted, { marginBottom: 4 }]}>
            Payment Method
          </Text>
          <View style={styles.chipRow}>
            {PAYMENT_METHODS.map((m) => (
              <Chip
                key={m}
                compact
                selected={newExpense.payment_method === m}
                onPress={() => setNewExpense({ ...newExpense, payment_method: m })}
              >
                {m.replace(/_/g, ' ')}
              </Chip>
            ))}
          </View>
          {categories && categories.length > 0 && (
            <>
              <Text variant="bodySmall" style={[styles.muted, { marginBottom: 4 }]}>
                Category
              </Text>
              <View style={styles.chipRow}>
                {categories.map((c: { id: string; name: string }) => (
                  <Chip
                    key={c.id}
                    compact
                    selected={newExpense.category_id === c.id}
                    onPress={() => setNewExpense({ ...newExpense, category_id: c.id })}
                  >
                    {c.name}
                  </Chip>
                ))}
              </View>
            </>
          )}
          <View style={styles.modalActions}>
            <Button onPress={() => setShowCreateModal(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleCreate} loading={createExpense.isPending}>
              Create
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
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
  list: { paddingTop: 4, paddingBottom: 80 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  modal: { backgroundColor: '#fff', margin: 20, padding: 20, borderRadius: 12 },
  input: { marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  muted: { color: '#6b7280' },
});
