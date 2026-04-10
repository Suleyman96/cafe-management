import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, IconButton } from 'react-native-paper';
import { Text } from '@/lib/paper-compat';

const METHOD_COLORS: Record<string, string> = {
  cash: '#10b981',
  card: '#367B8B',
  digital: '#8b5cf6',
  bank_transfer: '#f59e0b',
};

interface ExpenseCardProps {
  expense: {
    id: string;
    description?: string | null;
    amount: number;
    payment_method?: string | null;
    expense_date?: string | null;
    created_at: string;
    notes?: string | null;
    category?: { name: string } | null;
    created_by_staff?: { full_name: string } | null;
  };
  currencySymbol?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const ExpenseCard = React.memo(function ExpenseCard({
  expense,
  currencySymbol = '$',
  onEdit,
  onDelete,
}: ExpenseCardProps) {
  const method = expense.payment_method || 'cash';
  const methodColor = METHOD_COLORS[method] || '#6b7280';
  const displayDate = expense.expense_date || expense.created_at;

  return (
    <Card style={styles.card}>
      <Card.Content style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.info}>
            <Text variant="titleSmall" style={styles.description}>
              {expense.description || 'No description'}
            </Text>
            <Text variant="bodySmall" style={styles.muted}>
              {expense.category?.name || 'Uncategorized'} ·{' '}
              {expense.created_by_staff?.full_name || '—'}
            </Text>
            {expense.notes && (
              <Text variant="bodySmall" style={styles.notes} numberOfLines={2}>
                {expense.notes}
              </Text>
            )}
          </View>
          <Text variant="titleMedium" style={styles.amount}>
            {currencySymbol}
            {expense.amount.toFixed(2)}
          </Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.bottomRow}>
          <View style={styles.bottomLeft}>
            <Chip
              compact
              style={[styles.methodChip, { backgroundColor: methodColor }]}
              textStyle={{ color: '#fff', fontSize: 10, fontWeight: '600' }}
            >
              {method.replace(/_/g, ' ')}
            </Chip>
            <Text variant="bodySmall" style={styles.muted}>
              {new Date(displayDate).toLocaleDateString()}
            </Text>
          </View>
          {(onEdit || onDelete) && (
            <View style={styles.actions}>
              {onEdit && <IconButton icon="pencil" size={18} onPress={() => onEdit(expense.id)} />}
              {onDelete && (
                <IconButton
                  icon="delete"
                  size={18}
                  iconColor="#ef4444"
                  onPress={() => onDelete(expense.id)}
                />
              )}
            </View>
          )}
        </View>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 8 },
  content: { gap: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  info: { flex: 1, marginRight: 8, gap: 2 },
  description: { fontWeight: '600', color: '#1e293b' },
  notes: { color: '#9ca3af', fontStyle: 'italic', fontSize: 12 },
  amount: { fontWeight: '700', color: '#ef4444' },
  separator: { height: 1, backgroundColor: '#f1f5f9' },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  methodChip: { alignSelf: 'flex-start' },
  actions: { flexDirection: 'row' },
  muted: { color: '#6b7280' },
});
