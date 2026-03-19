import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, Text } from 'react-native-paper';

const METHOD_COLORS: Record<string, string> = {
  cash: '#10b981',
  card: '#3b82f6',
  digital: '#8b5cf6',
  bank_transfer: '#f59e0b',
};

interface ExpenseCardProps {
  expense: {
    id: string;
    description?: string | null;
    amount: number;
    payment_method?: string | null;
    created_at: string;
    expense_category?: { name: string } | null;
    created_by_staff?: { full_name: string } | null;
  };
  currencySymbol?: string;
}

export const ExpenseCard = React.memo(function ExpenseCard({
  expense,
  currencySymbol = '$',
}: ExpenseCardProps) {
  const method = expense.payment_method || 'cash';
  const methodColor = METHOD_COLORS[method] || '#6b7280';

  return (
    <Card style={styles.card}>
      <Card.Content style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.info}>
            <Text variant="titleSmall" style={styles.description}>
              {expense.description || 'No description'}
            </Text>
            <Text variant="bodySmall" style={styles.muted}>
              {expense.expense_category?.name || 'Uncategorized'} ·{' '}
              {expense.created_by_staff?.full_name || '—'}
            </Text>
          </View>
          <Text variant="titleMedium" style={styles.amount}>
            {currencySymbol}
            {expense.amount.toFixed(2)}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <Chip
            compact
            style={[styles.methodChip, { backgroundColor: methodColor }]}
            textStyle={{ color: '#fff', fontSize: 10, fontWeight: '600' }}
          >
            {method.replace(/_/g, ' ')}
          </Chip>
          <Text variant="bodySmall" style={styles.muted}>
            {new Date(expense.created_at).toLocaleDateString()}
          </Text>
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
  amount: { fontWeight: '700', color: '#ef4444' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  methodChip: { alignSelf: 'flex-start' },
  muted: { color: '#6b7280' },
});
