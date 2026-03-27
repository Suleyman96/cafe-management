import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Chip, FAB, SegmentedButtons, Text } from 'react-native-paper';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskModal } from '@/components/tasks/TaskModal';
import { EmptyState, LoadingScreen } from '@/components/ui';
import {
  useCreateTask,
  useDeleteTask,
  useGenerateRecurringTasks,
  useMarkTaskCompleted,
  useMarkTaskInProgress,
  useMyTasks,
  useOverdueTasksCount,
  useRecurringTemplates,
  useTasks,
  useTodaysTasks,
  useUpdateTask,
} from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { getLocalDateString } from '@/lib/date-utils';
import { useAuthStore } from '@/store/auth-store';
import type { Task } from '@/types';

type TabView = 'today' | 'all' | 'my' | 'templates';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function TasksListScreen() {
  const staff = useAuthStore((s) => s.staff);
  const isAdmin = staff?.role === 'admin' || staff?.role === 'owner';
  const { showSuccess, showError } = useSnackbar();
  const [tab, setTab] = useState<TabView>('today');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

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

  const generateRecurring = useGenerateRecurringTasks();
  const markInProgress = useMarkTaskInProgress();
  const markCompleted = useMarkTaskCompleted();
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
          filtered = filtered.filter((t: any) => t.status === statusFilter);
        }
        if (priorityFilter) {
          filtered = filtered.filter((t: any) => t.priority === priorityFilter);
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
    () => (todayTasks || []).filter((t: any) => t.status === 'completed').length,
    [todayTasks],
  );
  const openTasks = useMemo(
    () =>
      (allTasks || []).filter((t: any) => t.status === 'pending' || t.status === 'in_progress')
        .length,
    [allTasks],
  );

  const tabOptions = useMemo(() => {
    const base = [
      { value: 'today', label: 'Today' },
      { value: 'all', label: 'All' },
      { value: 'my', label: 'My Tasks' },
    ];
    if (isAdmin) base.push({ value: 'templates', label: 'Templates' });
    return base;
  }, [isAdmin]);

  const handleMarkInProgress = async (id: string) => {
    try {
      await markInProgress.mutateAsync(id);
      showSuccess('Task started');
    } catch (err: any) {
      showError(err?.message || 'Failed to start task');
    }
  };

  const handleMarkCompleted = async (id: string) => {
    try {
      await markCompleted.mutateAsync(id);
      showSuccess('Task completed');
    } catch (err: any) {
      showError(err?.message || 'Failed to complete task');
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setShowTaskModal(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask.mutateAsync(id);
            showSuccess('Task deleted');
          } catch (err: any) {
            showError(err?.message || 'Failed to delete task');
          }
        },
      },
    ]);
  };

  const handleSaveTask = async (data: any) => {
    try {
      if (editingTask) {
        await updateTask.mutateAsync({ id: editingTask.id, updates: data });
        showSuccess('Task updated');
      } else {
        await createTask.mutateAsync(data);
        showSuccess('Task created');
      }
      setShowTaskModal(false);
      setEditingTask(null);
    } catch (err: any) {
      showError(err?.message || 'Failed to save task');
    }
  };

  if (isLoading) return <LoadingScreen message="Loading tasks..." />;

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
              Open
            </Text>
            <Text variant="titleLarge" style={styles.boldText}>
              {openTasks}
            </Text>
          </Card.Content>
        </Card>
        <Card style={[styles.summaryCard, overdueCount ? styles.overdueCard : null]}>
          <Card.Content style={styles.summaryContent}>
            <Text variant="bodySmall" style={styles.muted}>
              Overdue
            </Text>
            <Text variant="titleLarge" style={[styles.boldText, { color: '#ef4444' }]}>
              {overdueCount || 0}
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content style={styles.summaryContent}>
            <Text variant="bodySmall" style={styles.muted}>
              Done Today
            </Text>
            <Text variant="titleLarge" style={[styles.boldText, { color: '#10b981' }]}>
              {completedToday}
            </Text>
          </Card.Content>
        </Card>
      </View>

      {(tab === 'all' || tab === 'my') && (
        <View style={styles.filterSection}>
          <Text variant="labelSmall" style={styles.filterLabel}>
            Status
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {STATUS_OPTIONS.map((opt) => (
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
            Priority
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {PRIORITY_OPTIONS.map((opt) => (
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

      <FlatList
        data={currentData}
        keyExtractor={(item: any) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            isAdmin={isAdmin}
            isTemplate={tab === 'templates'}
            onMarkInProgress={handleMarkInProgress}
            onMarkCompleted={handleMarkCompleted}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="checkbox-blank-outline"
            title={tab === 'templates' ? 'No recurring templates' : 'No tasks'}
            description={
              tab === 'templates' ? 'Create a recurring task template' : 'All caught up!'
            }
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
  container: { flex: 1, backgroundColor: '#f8fafc' },
  tabs: { marginHorizontal: 16, marginTop: 8, marginBottom: 8 },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  summaryCard: { flex: 1 },
  summaryContent: { alignItems: 'center', paddingVertical: 4 },
  overdueCard: { borderColor: '#fecaca', borderWidth: 1 },
  boldText: { fontWeight: '700' },
  muted: { color: '#6b7280' },
  filterSection: { paddingHorizontal: 16, marginBottom: 8 },
  filterLabel: { color: '#6b7280', marginBottom: 4 },
  filterRow: { flexDirection: 'row', marginBottom: 4 },
  filterChip: { marginRight: 6 },
  list: { paddingTop: 4, paddingBottom: 80 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
