import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  FAB,
  Modal,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';
import { TaskCard } from '@/components/tasks/TaskCard';
import { EmptyState, LoadingScreen } from '@/components/ui';
import {
  useCreateTask,
  useGenerateRecurringTasks,
  useMarkTaskCancelled,
  useMarkTaskCompleted,
  useMarkTaskInProgress,
  useMyTasks,
  useOverdueTasksCount,
  useTasks,
  useTodaysTasks,
} from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { useAuthStore } from '@/store/auth-store';
import type { Task } from '@/types';

const TAB_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'My Tasks' },
];

const PRIORITIES: Task['priority'][] = ['low', 'normal', 'high', 'urgent'];

export default function TasksListScreen() {
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();
  const [tab, setTab] = useState('today');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: todayTasks, isLoading: loadingToday, refetch: refetchToday } = useTodaysTasks();
  const {
    data: allTasks,
    isLoading: loadingAll,
    refetch: refetchAll,
  } = useTasks({ isTemplate: false });
  const { data: myTasks, isLoading: loadingMine, refetch: refetchMine } = useMyTasks(staff?.id);
  const { data: overdueCount } = useOverdueTasksCount();
  const generateRecurring = useGenerateRecurringTasks();
  const markInProgress = useMarkTaskInProgress();
  const markCompleted = useMarkTaskCompleted();
  const markCancelled = useMarkTaskCancelled();
  const createTask = useCreateTask();

  // Generate recurring tasks on mount
  useEffect(() => {
    generateRecurring.mutate(new Date().toISOString().split('T')[0]);
  }, [generateRecurring.mutate]);

  const currentData = tab === 'today' ? todayTasks : tab === 'mine' ? myTasks : allTasks;
  const isLoading = tab === 'today' ? loadingToday : tab === 'mine' ? loadingMine : loadingAll;
  const refetch = tab === 'today' ? refetchToday : tab === 'mine' ? refetchMine : refetchAll;

  const completedToday = useMemo(() => {
    return (todayTasks || []).filter((t: any) => t.status === 'completed').length;
  }, [todayTasks]);

  const [newTask, setNewTask] = useState<{
    title: string;
    description: string;
    priority: Task['priority'];
  }>({ title: '', description: '', priority: 'normal' });

  const handleCreate = async () => {
    if (!newTask.title.trim()) return;
    try {
      await createTask.mutateAsync({
        title: newTask.title.trim(),
        description: newTask.description.trim() || null,
        priority: newTask.priority,
        created_by: staff?.id ?? null,
        due_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        is_recurring: false,
        category_id: null,
        assigned_to: null,
        due_time: null,
        completed_at: null,
        recurrence_pattern: null,
        recurrence_days: null,
        parent_task_id: null,
        notes: null,
      });
      showSuccess('Task created');
      setShowCreateModal(false);
      setNewTask({ title: '', description: '', priority: 'normal' });
    } catch (err: any) {
      showError(err?.message || 'Failed to create task');
    }
  };

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

  const handleMarkCancelled = async (id: string) => {
    try {
      await markCancelled.mutateAsync(id);
      showSuccess('Task cancelled');
    } catch (err: any) {
      showError(err?.message || 'Failed to cancel task');
    }
  };

  if (isLoading) return <LoadingScreen message="Loading tasks..." />;

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={tab}
        onValueChange={setTab}
        buttons={TAB_OPTIONS}
        style={styles.tabs}
      />

      {/* Summary */}
      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.muted}>
              Open
            </Text>
            <Text variant="titleMedium" style={{ fontWeight: '700' }}>
              {
                (currentData || []).filter(
                  (t: any) => t.status !== 'completed' && t.status !== 'cancelled',
                ).length
              }
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.muted}>
              Overdue
            </Text>
            <Text variant="titleMedium" style={{ fontWeight: '700', color: '#ef4444' }}>
              {overdueCount || 0}
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.muted}>
              Done Today
            </Text>
            <Text variant="titleMedium" style={{ fontWeight: '700', color: '#10b981' }}>
              {completedToday}
            </Text>
          </Card.Content>
        </Card>
      </View>

      <FlatList
        data={currentData || []}
        keyExtractor={(item: any) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            onMarkInProgress={handleMarkInProgress}
            onMarkCompleted={handleMarkCompleted}
            onMarkCancelled={handleMarkCancelled}
          />
        )}
        ListEmptyComponent={
          <EmptyState icon="checkbox-blank-outline" title="No tasks" description="All caught up!" />
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
            New Task
          </Text>
          <TextInput
            label="Title"
            value={newTask.title}
            onChangeText={(v: string) => setNewTask({ ...newTask, title: v })}
            mode="outlined"
            dense
            style={styles.input}
          />
          <TextInput
            label="Description (optional)"
            value={newTask.description}
            onChangeText={(v: string) => setNewTask({ ...newTask, description: v })}
            mode="outlined"
            dense
            multiline
            style={styles.input}
          />
          <Text variant="bodySmall" style={[styles.muted, { marginBottom: 4 }]}>
            Priority
          </Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => (
              <Chip
                key={p}
                selected={newTask.priority === p}
                onPress={() => setNewTask({ ...newTask, priority: p })}
                compact
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Chip>
            ))}
          </View>
          <View style={styles.modalActions}>
            <Button onPress={() => setShowCreateModal(false)}>Cancel</Button>
            <Button
              mode="contained"
              onPress={handleCreate}
              loading={createTask.isPending}
              disabled={!newTask.title.trim()}
            >
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
  tabs: { marginHorizontal: 16, marginVertical: 8 },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  summaryCard: { flex: 1 },
  list: { paddingTop: 4, paddingBottom: 80 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  modal: { backgroundColor: '#fff', margin: 20, padding: 20, borderRadius: 12 },
  input: { marginBottom: 8 },
  priorityRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  muted: { color: '#6b7280' },
});
