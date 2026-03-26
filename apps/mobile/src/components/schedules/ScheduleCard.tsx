import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, IconButton, Text } from 'react-native-paper';

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#6b7280',
  in_progress: '#3b82f6',
  completed: '#10b981',
  missed: '#ef4444',
};

const STATUS_BG: Record<string, string> = {
  scheduled: '#f3f4f6',
  in_progress: '#dbeafe',
  completed: '#d1fae5',
  missed: '#fee2e2',
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
    staff?: { full_name: string; role?: string } | null;
  };
  onMarkInProgress?: (id: string) => void;
  onMarkCompleted?: (id: string) => void;
  onEdit?: (id: string) => void;
}

function getDurationHours(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
}

export const ScheduleCard = React.memo(function ScheduleCard({
  schedule,
  onMarkInProgress,
  onMarkCompleted,
  onEdit,
}: ScheduleCardProps) {
  const statusColor = STATUS_COLORS[schedule.status] || '#6b7280';
  const statusBg = STATUS_BG[schedule.status] || '#f3f4f6';
  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const duration = getDurationHours(schedule.actual_start, schedule.actual_end);

  return (
    <Card style={[styles.card, { borderLeftColor: statusColor }]}>
      <Card.Content style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.info}>
            <Text variant="titleSmall" style={styles.staffName}>
              {schedule.staff?.full_name || 'Unknown'}
            </Text>
            {schedule.staff?.role && (
              <Text variant="bodySmall" style={styles.role}>
                {schedule.staff.role}
              </Text>
            )}
          </View>
          <Chip
            compact
            style={[styles.statusChip, { backgroundColor: statusBg }]}
            textStyle={{ color: statusColor, fontSize: 10, fontWeight: '600' }}
          >
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            {'  '}
            {schedule.status.replace(/_/g, ' ')}
          </Chip>
        </View>

        {/* Planned times */}
        <View style={styles.timeRow}>
          <Text variant="bodySmall" style={styles.timeLabel}>
            Planned:
          </Text>
          <Text variant="bodyMedium" style={styles.timeValue}>
            {formatTime(schedule.planned_start)} — {formatTime(schedule.planned_end)}
          </Text>
        </View>

        {/* Actual times */}
        {(schedule.actual_start || schedule.actual_end) && (
          <View style={styles.timeRow}>
            <Text variant="bodySmall" style={styles.timeLabel}>
              Actual:
            </Text>
            <Text variant="bodyMedium" style={styles.timeValue}>
              {schedule.actual_start ? formatTime(schedule.actual_start) : '—'} —{' '}
              {schedule.actual_end ? formatTime(schedule.actual_end) : '—'}
            </Text>
            {duration != null && (
              <Chip compact style={styles.durationChip} textStyle={styles.durationText}>
                {duration}h
              </Chip>
            )}
          </View>
        )}

        {schedule.notes && (
          <Text variant="bodySmall" style={styles.notes} numberOfLines={2}>
            {schedule.notes}
          </Text>
        )}

        {/* Actions */}
        <View style={styles.separator} />
        <View style={styles.actionsRow}>
          <View style={styles.actionBtns}>
            {schedule.status === 'scheduled' && onMarkInProgress && (
              <Button
                compact
                mode="contained"
                onPress={() => onMarkInProgress(schedule.id)}
                style={{ backgroundColor: '#3b82f6' }}
                labelStyle={styles.actionLabel}
              >
                Start Shift
              </Button>
            )}
            {schedule.status === 'in_progress' && onMarkCompleted && (
              <Button
                compact
                mode="contained"
                onPress={() => onMarkCompleted(schedule.id)}
                style={{ backgroundColor: '#10b981' }}
                labelStyle={styles.actionLabel}
              >
                Complete
              </Button>
            )}
          </View>
          {onEdit && <IconButton icon="pencil" size={18} onPress={() => onEdit(schedule.id)} />}
        </View>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 8, borderLeftWidth: 4 },
  content: { gap: 4 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  info: { flex: 1, gap: 1 },
  staffName: { fontWeight: '600', color: '#1e293b' },
  role: { color: '#9ca3af', fontSize: 11, textTransform: 'capitalize' },
  statusChip: {},
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeLabel: { color: '#9ca3af', fontSize: 11, width: 52 },
  timeValue: { color: '#374151' },
  durationChip: { backgroundColor: '#f0fdf4', marginLeft: 'auto' },
  durationText: { color: '#15803d', fontSize: 10, fontWeight: '600' },
  notes: { color: '#6b7280', fontStyle: 'italic', fontSize: 12 },
  separator: { height: 1, backgroundColor: '#f1f5f9', marginTop: 4 },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionBtns: { flexDirection: 'row', gap: 8 },
  actionLabel: { fontSize: 12 },
});
