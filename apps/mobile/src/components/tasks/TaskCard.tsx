import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip } from 'react-native-paper';
import { Text } from '@/lib/paper-compat';

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6b7280',
  normal: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444',
};

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description?: string | null;
    priority?: string | null;
    status: string;
    due_date?: string | null;
    assigned_to_staff?: { full_name: string } | null;
    created_by_staff?: { full_name: string } | null;
  };
  onMarkInProgress: (id: string) => void;
  onMarkCompleted: (id: string) => void;
  onMarkCancelled: (id: string) => void;
}

export const TaskCard = React.memo(function TaskCard({
  task,
  onMarkInProgress,
  onMarkCompleted,
  onMarkCancelled,
}: TaskCardProps) {
  const priority = task.priority || 'normal';
  const priorityColor = PRIORITY_COLORS[priority] || '#3b82f6';
  const isOverdue =
    !!task.due_date &&
    new Date(task.due_date) < new Date() &&
    task.status !== 'completed' &&
    task.status !== 'cancelled';

  return (
    <Card style={[styles.card, { borderLeftColor: priorityColor }]}>
      <Card.Content style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.titleArea}>
            <Text variant="titleSmall" style={[styles.title, isOverdue && styles.overdueTitle]}>
              {task.title}
            </Text>
            {task.assigned_to_staff && (
              <Text variant="bodySmall" style={styles.muted}>
                Assigned to {task.assigned_to_staff.full_name}
              </Text>
            )}
          </View>
          <Chip
            compact
            style={[styles.priorityChip, { backgroundColor: priorityColor }]}
            textStyle={{ color: '#fff', fontSize: 10, fontWeight: '600' }}
          >
            {priority.toUpperCase()}
          </Chip>
        </View>

        {task.description && (
          <Text variant="bodySmall" style={styles.description} numberOfLines={2}>
            {task.description}
          </Text>
        )}

        <View style={styles.bottomRow}>
          {task.due_date && (
            <Text variant="bodySmall" style={[styles.dueDate, isOverdue && { color: '#ef4444' }]}>
              Due: {new Date(task.due_date).toLocaleDateString()}
            </Text>
          )}
          <Chip compact textStyle={{ fontSize: 10 }}>
            {task.status.replace(/_/g, ' ')}
          </Chip>
        </View>

        {task.status === 'pending' && (
          <View style={styles.actions}>
            <Button
              compact
              mode="contained"
              onPress={() => onMarkInProgress(task.id)}
              style={{ backgroundColor: '#3b82f6' }}
            >
              Start
            </Button>
            <Button compact onPress={() => onMarkCancelled(task.id)} textColor="#6b7280">
              Cancel
            </Button>
          </View>
        )}

        {task.status === 'in_progress' && (
          <View style={styles.actions}>
            <Button
              compact
              mode="contained"
              onPress={() => onMarkCompleted(task.id)}
              style={{ backgroundColor: '#10b981' }}
            >
              Complete
            </Button>
            <Button compact onPress={() => onMarkCancelled(task.id)} textColor="#6b7280">
              Cancel
            </Button>
          </View>
        )}
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 8, borderLeftWidth: 4 },
  content: { gap: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleArea: { flex: 1, marginRight: 8 },
  title: { fontWeight: '600', color: '#1e293b' },
  overdueTitle: { color: '#ef4444' },
  priorityChip: { alignSelf: 'flex-start' },
  description: { color: '#6b7280' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dueDate: { color: '#6b7280', fontSize: 12 },
  muted: { color: '#6b7280', fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
});
