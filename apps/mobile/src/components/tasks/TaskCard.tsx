import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocale, useTranslation } from '@gustri/i18n';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, IconButton } from 'react-native-paper';
import { getLocalDateString } from '@/lib/date-utils';
import { Text } from '@/lib/paper-compat';
import { BRAND_PRIMARY, CARD_RADIUS, TYPOGRAPHY } from '@/theme';
import type { Task } from '@/types';

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: '#f3f4f6', text: '#374151' },
  normal: { bg: '#dbeafe', text: '#1d4ed8' },
  high: { bg: '#ffedd5', text: '#c2410c' },
  urgent: { bg: '#fee2e2', text: '#dc2626' },
};

const STATUS_CONFIG: Record<
  string,
  { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; color: string }
> = {
  pending: { icon: 'circle-outline', color: '#9ca3af' },
  in_progress: { icon: 'play-circle', color: BRAND_PRIMARY },
  completed: { icon: 'check-circle', color: '#10b981' },
  cancelled: { icon: 'close-circle', color: '#9ca3af' },
};

const WEEKDAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface TaskCardProps {
  task: Task & {
    assigned_to_staff?: { full_name: string } | null;
    parent_task_id?: string | null;
    is_recurring?: boolean;
    recurrence_pattern?: string | null;
    recurrence_days?: number[] | null;
    due_time?: string | null;
  };
  isAdmin: boolean;
  isTemplate?: boolean;
  onMarkInProgress: (id: string) => void;
  onMarkCompleted: (id: string) => void;
  onMarkCancelled: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export const TaskCard = React.memo(function TaskCard({
  task,
  isAdmin,
  isTemplate,
  onMarkInProgress,
  onMarkCompleted,
  onMarkCancelled,
  onEdit,
  onDelete,
}: TaskCardProps) {
  const { t } = useTranslation('staff');
  const locale = useLocale();

  const RECURRENCE_LABELS: Record<string, string> = useMemo(
    () => ({
      daily: t('tasks.daily'),
      weekly: t('tasks.weekly'),
      monthly: t('tasks.monthly'),
    }),
    [t],
  );

  const priority = task.priority || 'normal';
  const priorityStyle = PRIORITY_COLORS[priority] || PRIORITY_COLORS.normal;
  const statusConfig = (task.status && STATUS_CONFIG[task.status]) || STATUS_CONFIG.pending;

  const isOverdue =
    !!task.due_date &&
    task.due_date < getLocalDateString() &&
    task.status !== 'completed' &&
    task.status !== 'cancelled';

  const getWeekdayLabels = (days: number[]) => days.map((d) => WEEKDAY_NAMES[d] || d).join(', ');

  return (
    <Card style={[styles.card, isOverdue && styles.overdueCard]}>
      <Card.Content style={styles.content}>
        {/* Top: status icon + title + actions */}
        <View style={styles.topRow}>
          <MaterialCommunityIcons
            name={statusConfig.icon}
            size={20}
            color={statusConfig.color}
            style={styles.statusIcon}
          />
          <View style={styles.titleArea}>
            <View style={styles.titleRow}>
              <Text
                variant="titleSmall"
                style={[styles.title, isOverdue && styles.overdueTitle]}
                numberOfLines={1}
              >
                {task.title}
              </Text>
              {task.parent_task_id && (
                <MaterialCommunityIcons name="repeat" size={14} color="#60a5fa" />
              )}
            </View>
            {task.description && (
              <Text variant="bodySmall" style={styles.description} numberOfLines={1}>
                {task.description}
              </Text>
            )}
          </View>
        </View>

        {/* Meta row: priority, assignee, due date, recurrence */}
        <View style={styles.metaRow}>
          <Chip
            compact
            style={[styles.priorityChip, { backgroundColor: priorityStyle.bg }]}
            textStyle={{ color: priorityStyle.text, fontSize: 10, fontWeight: '600' }}
          >
            {priority}
          </Chip>

          {task.assigned_to_staff?.full_name && (
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="account" size={12} color="#6b7280" />
              <Text variant="bodySmall" style={styles.metaText}>
                {task.assigned_to_staff.full_name}
              </Text>
            </View>
          )}

          {task.due_date && !task.is_recurring && (
            <View style={styles.metaItem}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={12}
                color={isOverdue ? '#ef4444' : '#6b7280'}
              />
              <Text
                variant="bodySmall"
                style={[styles.metaText, isOverdue && { color: '#ef4444', fontWeight: '600' }]}
              >
                {new Date(task.due_date).toLocaleDateString(locale)}
                {task.due_time ? ` ${task.due_time.slice(0, 5)}` : ''}
              </Text>
            </View>
          )}

          {task.is_recurring && (
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="repeat" size={12} color={BRAND_PRIMARY} />
              <Text variant="bodySmall" style={[styles.metaText, { color: BRAND_PRIMARY }]}>
                {RECURRENCE_LABELS[task.recurrence_pattern || ''] || task.recurrence_pattern}
                {task.recurrence_pattern === 'weekly' && task.recurrence_days?.length
                  ? ` (${getWeekdayLabels(task.recurrence_days)})`
                  : ''}
                {task.recurrence_pattern === 'monthly' && task.recurrence_days?.length
                  ? ` (Day ${task.recurrence_days[0]})`
                  : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Actions row */}
        <View style={styles.actionsRow}>
          {/* Quick status actions (not for templates) */}
          {!isTemplate && task.status === 'pending' && (
            <IconButton
              icon="play"
              size={18}
              iconColor={BRAND_PRIMARY}
              onPress={() => onMarkInProgress(task.id)}
              style={styles.actionBtn}
            />
          )}
          {!isTemplate && (task.status === 'pending' || task.status === 'in_progress') && (
            <IconButton
              icon="check-circle"
              size={18}
              iconColor="#10b981"
              onPress={() => onMarkCompleted(task.id)}
              style={styles.actionBtn}
            />
          )}
          {!isTemplate && (task.status === 'pending' || task.status === 'in_progress') && (
            <IconButton
              icon="close-circle"
              size={18}
              iconColor="#9ca3af"
              onPress={() => onMarkCancelled(task.id)}
              style={styles.actionBtn}
            />
          )}

          {/* Edit */}
          <IconButton
            icon="pencil"
            size={18}
            iconColor="#6b7280"
            onPress={() => onEdit(task as Task)}
            style={styles.actionBtn}
          />

          {/* Delete (admin only) */}
          {isAdmin && (
            <IconButton
              icon="delete"
              size={18}
              iconColor="#ef4444"
              onPress={() => onDelete(task.id)}
              style={styles.actionBtn}
            />
          )}
        </View>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 8, borderRadius: CARD_RADIUS },
  overdueCard: { borderColor: '#fca5a5', borderWidth: 1, backgroundColor: '#fef2f2' },
  content: { gap: 6 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start' },
  statusIcon: { marginRight: 8, marginTop: 2 },
  titleArea: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...TYPOGRAPHY.cardTitle, color: '#1e293b', flex: 1 },
  overdueTitle: { color: '#ef4444' },
  description: { color: '#6b7280', marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginLeft: 28 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { color: '#6b7280', ...TYPOGRAPHY.badge },
  priorityChip: { height: 22 },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 2,
  },
  actionBtn: { margin: 0 },
});
