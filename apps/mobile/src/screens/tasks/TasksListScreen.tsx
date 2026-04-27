import type { TaskInsert, TaskUpdate } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { FlashList } from '@shopify/flash-list';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Chip, FAB, SegmentedButtons, Text } from 'react-native-paper';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskModal } from '@/components/tasks/TaskModal';
import { EmptyState, LoadingScreen } from '@/components/ui';
import {
  useCreateTask,
  useDeleteTask,
  useGenerateRecurringTasks,
  useMarkTaskCancelled,
  useMarkTaskCompleted,
  useMarkTaskInProgress,
  useMyTasks,
  useOpenTasksCount,
  useOverdueTasksCount,
  useRecurringTemplates,
  useTasks,
  useTodaysTasks,
  useUpdateTask,
} from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { getLocalDateString } from '@/lib/date-utils';
import { useAuthStore } from '@/store/auth-store';
import { COLORS } from '@/theme';
import type { Task } from '@/types';

type TabView = 'today' | 'all' | 'my' | 'templates';

export default function TasksListScreen() {
  const staff = useAuthStore((s) => s.staff);
  const isAdmin = staff?.role === 'admin' || staff?.role === 'owner';
  const { showSuccess, showError } = useSnackbar();
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const [tab, setTab] = useState<TabView>('today');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const statusOptions = useMemo(
    () => [
      { value: '', label: tCommon('all') },
      { value: 'pending', label: t('tasks.pending') },
      { value: 'in_progress', label: t('tasks.inProgress') },
      { value: 'completed', label: t('tasks.completed') },
      { value: 'cancelled', label: t('tasks.cancelled') },
    ],
    [t, tCommon],
  );

  const priorityOptions = useMemo(
    () => [
      { value: '', label: tCommon('all') },
      { value: 'low', label: t('tasks.low') },
      { value: 'normal', label: t('tasks.normal') },
      { value: 'high', label: t('tasks.high') },
      { value: 'urgent', label: t('tasks.urgent') },
    ],
    [t, tCommon],
  );

  const { data: todayTasks, isLoading: loadingToday, refetch: refetchToday } = useTodaysTasks();
  const {
    data: allTasks,
    isLoading: loadingAll,
    refetch: refetchAll,
  } = useTasks({
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    isTemplate: false,
  });
  const { data: myTasks, isLoading: loadingMine, refetch: refetchMine } = useMyTasks(staff?.id);
  const {
    data: templates,
    isLoading: loadingTemplates,
    refetch: refetchTemplates,
  } = useRecurringTemplates();
  const { data: overdueCount } = useOverdueTasksCount();
  const { data: openTasksCount = 0 } = useOpenTasksCount();

  const generateRecurring = useGenerateRecurringTasks();
  const markInProgress = useMarkTaskInProgress();
  const markCompleted = useMarkTaskCompleted();
  const markCancelled = useMarkTaskCancelled();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const hasGenerated = useRef(false);
  useEffect(() => {
    if (hasGenerated.current) return;
    hasGenerated.current = true;
    generateRecurring.mutate(getLocalDateString());
  }, [generateRecurring.mutate]);

  const currentData = useMemo(() => {
    switch (tab) {
      case 'today':
        return todayTasks || [];
      case 'all':
        return allTasks || [];
      case 'my': {
        let filtered = myTasks || [];
        if (statusFilter) {
          filtered = filtered.filter((t) => t.status === statusFilter);
        }
        if (priorityFilter) {
          filtered = filtered.filter((t) => t.priority === priorityFilter);
        }
        return filtered;
      }
      case 'templates':
        return templates || [];
      default:
        return [];
    }
  }, [tab, todayTasks, allTasks, myTasks, templates, statusFilter, priorityFilter]);

  const isLoading =
    tab === 'today'
      ? loadingToday
      : tab === 'all'
        ? loadingAll
        : tab === 'my'
          ? loadingMine
          : loadingTemplates;

  const refetch =
    tab === 'today'
      ? refetchToday
      : tab === 'all'
        ? refetchAll
        : tab === 'my'
          ? refetchMine
          : refetchTemplates;

  const completedToday = useMemo(
    () => (todayTasks || []).filter((t) => t.status === 'completed').length,
    [todayTasks],
  );

  const tabOptions = useMemo(() => {
    const base = [
      { value: 'today', label: t('tasks.today') },
      { value: 'all', label: tCommon('all') },
      { value: 'my', label: t('tasks.myTasks') },
    ];
    if (isAdmin) base.push({ value: 'templates', label: t('tasks.templates') });
    return base;
  }, [isAdmin, t, tCommon]);

  const handleMarkInProgress = async (id: string) => {
    try {
      await markInProgress.mutateAsync(id);
      showSuccess(t('tasks.taskStarted'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('tasks.failedStart'));
    }
  };

  const handleMarkCompleted = async (id: string) => {
    try {
      await markCompleted.mutateAsync(id);
      showSuccess(t('tasks.taskCompleted'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('tasks.failedComplete'));
    }
  };

  const handleMarkCancelled = async (id: string) => {
    try {
      await markCancelled.mutateAsync(id);
      showSuccess(t('tasks.taskCancelled'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('tasks.failedCancel'));
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setShowTaskModal(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert(t('tasks.deleteTask'), t('tasks.deleteTaskConfirm'), [
      { text: tCommon('cancel'), style: 'cancel' },
      {
        text: tCommon('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask.mutateAsync(id);
            showSuccess(t('tasks.taskDeleted'));
          } catch (err: unknown) {
            showError(err instanceof Error ? err.message : t('tasks.failedDelete'));
          }
        },
      },
    ]);
  };

  const handleSaveTask = async (data: Record<string, unknown>) => {
    try {
      if (editingTask) {
        await updateTask.mutateAsync({
          id: editingTask.id,
          updates: data as unknown as TaskUpdate,
        });
        showSuccess(t('tasks.taskUpdated'));
      } else {
        await createTask.mutateAsync(data as unknown as TaskInsert);
        showSuccess(t('tasks.taskCreated'));
      }
      setShowTaskModal(false);
      setEditingTask(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('tasks.failedSave'));
    }
  };

  if (isLoading) return <LoadingScreen message={t('tasks.loadingTasks')} />;

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={tab}
        onValueChange={(v) => setTab(v as TabView)}
        buttons={tabOptions}
        style={styles.tabs}
        density="small"
      />

      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Card.Content style={styles.summaryContent}>
            <Text variant="bodySmall" style={styles.muted}>
              {t('tasks.open')}
            </Text>
            <Text variant="titleLarge" style={styles.boldText}>
              {openTasksCount}
            </Text>
          </Card.Content>
        </Card>
        <Card style={[styles.summaryCard, overdueCount ? styles.overdueCard : null]}>
          <Card.Content style={styles.summaryContent}>
            <Text variant="bodySmall" style={styles.muted}>
              {t('tasks.overdue')}
            </Text>
            <Text variant="titleLarge" style={[styles.boldText, { color: COLORS.danger }]}>
              {overdueCount ?? 0}
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content style={styles.summaryContent}>
            <Text variant="bodySmall" style={styles.muted}>
              {t('tasks.doneToday')}
            </Text>
            <Text variant="titleLarge" style={[styles.boldText, { color: COLORS.success }]}>
              {completedToday}
            </Text>
          </Card.Content>
        </Card>
      </View>

      {(tab === 'all' || tab === 'my') && (
        <View style={styles.filterSection}>
          <Text variant="labelSmall" style={styles.filterLabel}>
            {tCommon('status')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {statusOptions.map((opt) => (
              <Chip
                key={opt.value}
                selected={statusFilter === opt.value}
                onPress={() => setStatusFilter(opt.value)}
                compact
                style={styles.filterChip}
              >
                {opt.label}
              </Chip>
            ))}
          </ScrollView>
          <Text variant="labelSmall" style={[styles.filterLabel, { marginTop: 4 }]}>
            {t('tasks.priority')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {priorityOptions.map((opt) => (
              <Chip
                key={opt.value}
                selected={priorityFilter === opt.value}
                onPress={() => setPriorityFilter(opt.value)}
                compact
                style={styles.filterChip}
              >
                {opt.label}
              </Chip>
            ))}
          </ScrollView>
        </View>
      )}

      <FlashList
        data={currentData}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            isAdmin={isAdmin}
            isTemplate={tab === 'templates'}
            onMarkInProgress={handleMarkInProgress}
            onMarkCompleted={handleMarkCompleted}
            onMarkCancelled={handleMarkCancelled}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="checkbox-blank-outline"
            title={tab === 'templates' ? t('tasks.noTemplates') : t('tasks.noTasks')}
            description={tab !== 'templates' ? t('tasks.allCaughtUp') : undefined}
          />
        }
        contentContainerStyle={styles.list}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          setEditingTask(null);
          setShowTaskModal(true);
        }}
      />

      {showTaskModal && (
        <TaskModal
          task={editingTask}
          staffId={staff?.id}
          isAdmin={isAdmin}
          onSave={handleSaveTask}
          isSaving={createTask.isPending || updateTask.isPending}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabs: { marginHorizontal: 16, marginTop: 8, marginBottom: 8 },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  summaryCard: { flex: 1 },
  summaryContent: { alignItems: 'center', paddingVertical: 4 },
  overdueCard: { borderColor: '#fecaca', borderWidth: 1 },
  boldText: { fontWeight: '700' },
  muted: { color: COLORS.textMuted },
  filterSection: { paddingHorizontal: 16, marginBottom: 8 },
  filterLabel: { color: COLORS.textMuted, marginBottom: 4 },
  filterRow: { flexDirection: 'row', marginBottom: 4 },
  filterChip: { marginRight: 6 },
  list: { paddingTop: 4, paddingBottom: 80 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
