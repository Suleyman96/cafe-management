import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text } from 'react-native-paper';

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#6b7280',
  in_progress: '#3b82f6',
  completed: '#10b981',
  missed: '#ef4444',
};

interface ScheduleCardProps {
  schedule: {
    id: string;
    planned_start: string;
    planned_end: string;
    actual_start?: string | null;
    actual_end?: string | null;
    status: string;
    notes?: string | null;
    staff?: { full_name: string } | null;
  };
  onMarkInProgress?: (id: string) => void;
  onMarkCompleted?: (id: string) => void;
  onEdit?: (id: string) => void;
}

export const ScheduleCard = React.memo(function ScheduleCard({
  schedule,
  onMarkInProgress,
  onMarkCompleted,
  onEdit,
}: ScheduleCardProps) {
  const statusColor = STATUS_COLORS[schedule.status] || '#6b7280';
  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Card style={[styles.card, { borderLeftColor: statusColor }]}>
      <Card.Content style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.info}>
            <Text variant="titleSmall" style={styles.staffName}>
              {schedule.staff?.full_name || 'Unknown'}
            </Text>
            <Text variant="bodyMedium">
              {formatTime(schedule.planned_start)} — {formatTime(schedule.planned_end)}
            </Text>
          </View>
          <Chip
            compact
            style={[styles.statusChip, { backgroundColor: statusColor }]}
            textStyle={{ color: '#fff', fontSize: 10, fontWeight: '600' }}
          >
            {schedule.status.replace(/_/g, ' ')}
          </Chip>
        </View>

        {(schedule.actual_start || schedule.actual_end) && (
          <Text variant="bodySmall" style={styles.muted}>
            Actual: {schedule.actual_start ? formatTime(schedule.actual_start) : '—'} —{' '}
            {schedule.actual_end ? formatTime(schedule.actual_end) : '—'}
          </Text>
        )}

        {schedule.notes && (
          <Text variant="bodySmall" style={styles.notes}>
            {schedule.notes}
          </Text>
        )}

        <View style={styles.actions}>
          {schedule.status === 'scheduled' && onMarkInProgress && (
            <Button
              compact
              mode="contained"
              onPress={() => onMarkInProgress(schedule.id)}
              style={{ backgroundColor: '#3b82f6' }}
            >
              Start
            </Button>
          )}
          {schedule.status === 'in_progress' && onMarkCompleted && (
            <Button
              compact
              mode="contained"
              onPress={() => onMarkCompleted(schedule.id)}
              style={{ backgroundColor: '#10b981' }}
            >
              Complete
            </Button>
          )}
          {onEdit && (
            <Button compact onPress={() => onEdit(schedule.id)}>
              Edit
            </Button>
          )}
        </View>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 8, borderLeftWidth: 4 },
  content: { gap: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  info: { flex: 1, gap: 2 },
  staffName: { fontWeight: '600', color: '#1e293b' },
  statusChip: {},
  muted: { color: '#6b7280' },
  notes: { color: '#6b7280', fontStyle: 'italic' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
});
