import { useTranslation } from '@gustri/i18n';
import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, FAB } from 'react-native-paper';
import { ExpenseCard } from '@/components/expenses/ExpenseCard';
import { ExpenseCategoryModal } from '@/components/expenses/ExpenseCategoryModal';
import { ExpenseModal } from '@/components/expenses/ExpenseModal';
import { ConfirmDialog, EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import {
  useCreateExpense,
  useCreateExpenseCategory,
  useCurrencySymbol,
  useDeleteExpense,
  useDeleteExpenseCategory,
  useExpenseCategories,
  useExpenseMonthlySummary,
  useExpenses,
  useUpdateExpense,
  useUpdateExpenseCategory,
} from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { Text } from '@/lib/paper-compat';
import { useAuthStore } from '@/store/auth-store';
import { BRAND_PRIMARY, COLORS } from '@/theme';
import type { Expense } from '@/types';

const PAYMENT_METHODS: Expense['payment_method'][] = ['cash', 'card', 'digital', 'bank_transfer'];

export default function ExpensesListScreen() {
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [methodFilter, setMethodFilter] = useState<string | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();

  // Modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const {
    data: expenses,
    isLoading,
    error,
    refetch,
  } = useExpenses({ startDate, endDate, paymentMethod: methodFilter, categoryId: categoryFilter });
  const { data: summary } = useExpenseMonthlySummary(year, month);
  const { data: categories } = useExpenseCategories();

  // Mutations
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpenseMut = useDeleteExpense();
  const createCategory = useCreateExpenseCategory();
  const updateCategory = useUpdateExpenseCategory();
  const deleteCategory = useDeleteExpenseCategory();

  const currencySymbol = useCurrencySymbol();

  // Top category from summary
  const topCategory = useMemo(() => {
    if (!summary?.byCategory?.length) return null;
    return summary.byCategory.reduce((max, c) => (c.total > max.total ? c : max));
  }, [summary]);

  // Category breakdown with percentages
  const categoryBreakdown = useMemo(() => {
    if (!summary?.byCategory?.length || !summary.total) return [];
    return summary.byCategory
      .map((c) => ({
        ...c,
        percentage: Math.round((c.total / summary.total) * 100),
      }))
      .sort((a, b) => b.total - a.total);
  }, [summary]);

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

  const handleExpenseSubmit = async (data: {
    description: string;
    amount: number;
    payment_method: Expense['payment_method'];
    category_id: string | null;
    expense_date: string;
    notes: string | null;
  }) => {
    try {
      if (editExpense) {
        await updateExpense.mutateAsync({ id: editExpense.id, data });
        showSuccess(t('expenses.expenseUpdated'));
      } else {
        if (!staff?.id) {
          showError(t('payment.notAuthenticated'));
          return;
        }
        await createExpense.mutateAsync({
          ...data,
          created_by: staff.id,
          receipt_url: null,
        });
        showSuccess(t('expenses.expenseRecorded'));
      }
      setShowExpenseModal(false);
      setEditExpense(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('expenses.failedSave'));
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteExpenseId) return;
    try {
      await deleteExpenseMut.mutateAsync(deleteExpenseId);
      showSuccess(t('expenses.expenseDeleted'));
      setDeleteExpenseId(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('expenses.failedDelete'));
    }
  };

  const handleEditExpense = (id: string) => {
    const expense = expenses?.find((e: { id: string }) => e.id === id);
    if (expense) {
      setEditExpense(expense);
      setShowExpenseModal(true);
    }
  };

  const handleCategoryCreate = async (data: { name: string; description?: string }) => {
    try {
      await createCategory.mutateAsync({
        name: data.name,
        description: data.description ?? null,
        icon: null,
        is_active: true,
      });
      showSuccess(t('expenses.categoryCreated'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('expenses.failedCreateCategory'));
    }
  };

  const handleCategoryUpdate = async (id: string, data: { name: string; description?: string }) => {
    try {
      await updateCategory.mutateAsync({
        id,
        data: { name: data.name, description: data.description },
      });
      showSuccess(t('expenses.categoryUpdated'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('expenses.failedUpdateCategory'));
    }
  };

  const handleCategoryDelete = async (id: string) => {
    try {
      await deleteCategory.mutateAsync(id);
      showSuccess(t('expenses.categoryDeleted'));
      if (categoryFilter === id) setCategoryFilter(undefined);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('expenses.failedDeleteCategory'));
    }
  };

  if (isLoading) return <LoadingScreen message={t('expenses.loadingExpenses')} />;
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

      {/* Summary Cards — 3 cards like staff-web */}
      {summary && (
        <View style={styles.summaryRow}>
          <Card style={styles.summaryCard}>
            <Card.Content>
              <Text variant="bodySmall" style={styles.muted}>
                {tCommon('total')}
              </Text>
              <Text variant="titleMedium" style={styles.totalValue}>
                {currencySymbol}
                {(summary.total || 0).toFixed(2)}
              </Text>
            </Card.Content>
          </Card>
          <Card style={styles.summaryCard}>
            <Card.Content>
              <Text variant="bodySmall" style={styles.muted}>
                {t('expenses.transactions')}
              </Text>
              <Text variant="titleMedium" style={styles.transValue}>
                {summary.count || 0}
              </Text>
            </Card.Content>
          </Card>
          <Card style={styles.summaryCard}>
            <Card.Content>
              <Text variant="bodySmall" style={styles.muted}>
                {t('expenses.topCategory')}
              </Text>
              <Text variant="titleSmall" style={styles.topCatValue} numberOfLines={1}>
                {topCategory?.name || '—'}
              </Text>
            </Card.Content>
          </Card>
        </View>
      )}

      {/* Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <Card style={styles.breakdownCard}>
          <Card.Content>
            <Text variant="bodySmall" style={[styles.muted, { marginBottom: 8 }]}>
              {t('expenses.categoryBreakdown')}
            </Text>
            {categoryBreakdown.map((cat) => (
              <View key={cat.name} style={styles.breakdownRow}>
                <View style={styles.breakdownLabel}>
                  <Text variant="bodySmall" style={styles.breakdownName} numberOfLines={1}>
                    {cat.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.muted}>
                    {currencySymbol}
                    {cat.total.toFixed(2)} ({cat.percentage}%)
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${cat.percentage}%` }]} />
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Filters: Category + Payment Method */}
      <View style={styles.filterSection}>
        <View style={styles.filterHeader}>
          <Text variant="bodySmall" style={styles.muted}>
            {t('expenses.filters')}
          </Text>
          <Button
            compact
            mode="outlined"
            icon="shape-plus"
            onPress={() => setShowCategoryModal(true)}
            labelStyle={styles.manageCatLabel}
            style={styles.manageCatBtn}
          >
            {t('expenses.categories')}
          </Button>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}
        >
          <Chip compact selected={!categoryFilter} onPress={() => setCategoryFilter(undefined)}>
            {t('expenses.allCategories')}
          </Chip>
          {(categories || []).map((c: { id: string; name: string }) => (
            <Chip
              key={c.id}
              compact
              selected={categoryFilter === c.id}
              onPress={() => setCategoryFilter(categoryFilter === c.id ? undefined : c.id)}
            >
              {c.name}
            </Chip>
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}
        >
          <Chip compact selected={!methodFilter} onPress={() => setMethodFilter(undefined)}>
            {t('expenses.allMethods')}
          </Chip>
          {PAYMENT_METHODS.map((m) => (
            <Chip
              key={m}
              compact
              selected={methodFilter === m}
              onPress={() => setMethodFilter(methodFilter === m ? undefined : m)}
            >
              {m === 'bank_transfer' ? tCommon('bankTransfer') : tCommon(m)}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {/* Expense count */}
      <Text variant="bodySmall" style={styles.countText}>
        {t('expenses.expenseCount', { count: (expenses || []).length })}
      </Text>

      <FlashList
        data={expenses || []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <ExpenseCard
            expense={item}
            currencySymbol={currencySymbol}
            onEdit={handleEditExpense}
            onDelete={(id) => setDeleteExpenseId(id)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="cash-off"
            title={t('expenses.noExpenses')}
            description={t('expenses.noExpensesThisMonth')}
          />
        }
        contentContainerStyle={styles.list}
      />

      <FAB
        icon="plus"
        label={t('expenses.addExpense')}
        style={styles.fab}
        onPress={() => {
          setEditExpense(null);
          setShowExpenseModal(true);
        }}
      />

      <ExpenseModal
        visible={showExpenseModal}
        onDismiss={() => {
          setShowExpenseModal(false);
          setEditExpense(null);
        }}
        onSubmit={handleExpenseSubmit}
        loading={createExpense.isPending || updateExpense.isPending}
        initialData={editExpense}
        categories={categories || []}
        currencySymbol={currencySymbol}
      />

      <ExpenseCategoryModal
        visible={showCategoryModal}
        onDismiss={() => setShowCategoryModal(false)}
        categories={categories || []}
        onCreate={handleCategoryCreate}
        onUpdate={handleCategoryUpdate}
        onDelete={handleCategoryDelete}
        loading={createCategory.isPending || updateCategory.isPending}
      />

      <ConfirmDialog
        visible={!!deleteExpenseId}
        title={t('expenses.deleteExpense')}
        message={t('expenses.deleteExpenseConfirm')}
        onConfirm={handleDeleteExpense}
        onCancel={() => setDeleteExpenseId(null)}
        destructive
      />
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
  totalValue: { fontWeight: '700', color: COLORS.danger },
  transValue: { fontWeight: '700', color: BRAND_PRIMARY },
  topCatValue: { fontWeight: '700', color: COLORS.purpleLight },
  breakdownCard: { marginHorizontal: 16, marginBottom: 8 },
  breakdownRow: { marginBottom: 8 },
  breakdownLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  breakdownName: { fontWeight: '600', color: COLORS.textPrimary, flex: 1, marginRight: 8 },
  progressBarBg: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: COLORS.indigo,
    borderRadius: 3,
  },
  filterSection: { paddingHorizontal: 16, marginBottom: 8 },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  manageCatBtn: { borderColor: COLORS.border },
  manageCatLabel: { fontSize: 11 },
  filterChips: { gap: 6, paddingBottom: 6 },
  countText: { color: COLORS.textLight, paddingHorizontal: 16, marginBottom: 4 },
  list: { paddingTop: 4, paddingBottom: 80 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  muted: { color: COLORS.textMuted },
});
