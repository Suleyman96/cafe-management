import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Modal, Portal, Text } from 'react-native-paper';
import { getLocalDateString } from '@/lib/date-utils';
import { TextInput } from '@/lib/paper-compat';
import type { Expense } from '@/types';

const PAYMENT_METHODS: Expense['payment_method'][] = ['cash', 'card', 'digital', 'bank_transfer'];

interface ExpenseModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (data: {
    description: string;
    amount: number;
    payment_method: string;
    category_id: string | null;
    expense_date: string;
    notes: string | null;
  }) => void;
  loading?: boolean;
  initialData?: any;
  categories: { id: string; name: string }[];
  currencySymbol?: string;
}

export function ExpenseModal({
  visible,
  onDismiss,
  onSubmit,
  loading,
  initialData,
  categories,
  currencySymbol = '$',
}: ExpenseModalProps) {
  const [form, setForm] = useState({
    description: '',
    amount: '',
    payment_method: 'cash' as string,
    category_id: '',
    expense_date: getLocalDateString(),
    notes: '',
  });

  useEffect(() => {
    if (!visible) return;
    if (initialData) {
      setForm({
        description: initialData.description || '',
        amount: String(initialData.amount || ''),
        payment_method: initialData.payment_method || 'cash',
        category_id: initialData.category_id || '',
        expense_date: initialData.expense_date || getLocalDateString(),
        notes: initialData.notes || '',
      });
    } else {
      setForm({
        description: '',
        amount: '',
        payment_method: 'cash',
        category_id: '',
        expense_date: getLocalDateString(),
        notes: '',
      });
    }
  }, [visible, initialData]);

  const handleSubmit = () => {
    const amount = Number.parseFloat(form.amount);
    if (Number.isNaN(amount) || amount <= 0) return;
    onSubmit({
      description: form.description,
      amount,
      payment_method: form.payment_method,
      category_id: form.category_id || null,
      expense_date: form.expense_date,
      notes: form.notes || null,
    });
  };

  const isValid = form.description.trim() && Number.parseFloat(form.amount) > 0;

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        <ScrollView>
          <Text variant="titleMedium" style={styles.title}>
            {initialData ? 'Edit Expense' : 'New Expense'}
          </Text>

          <TextInput
            label="Amount *"
            value={form.amount}
            onChangeText={(v: string) => setForm({ ...form, amount: v })}
            mode="outlined"
            keyboardType="decimal-pad"
            left={<TextInput.Affix text={currencySymbol} />}
            dense
            style={styles.input}
          />

          <TextInput
            label="Description *"
            value={form.description}
            onChangeText={(v: string) => setForm({ ...form, description: v })}
            mode="outlined"
            dense
            style={styles.input}
          />

          <Text variant="bodySmall" style={styles.label}>
            Payment Method
          </Text>
          <View style={styles.chipRow}>
            {PAYMENT_METHODS.map((m) => (
              <Chip
                key={m}
                compact
                selected={form.payment_method === m}
                onPress={() => setForm({ ...form, payment_method: m })}
              >
                {m.replace(/_/g, ' ')}
              </Chip>
            ))}
          </View>

          {categories.length > 0 && (
            <>
              <Text variant="bodySmall" style={styles.label}>
                Category
              </Text>
              <View style={styles.chipRow}>
                <Chip
                  compact
                  selected={!form.category_id}
                  onPress={() => setForm({ ...form, category_id: '' })}
                >
                  None
                </Chip>
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    compact
                    selected={form.category_id === c.id}
                    onPress={() => setForm({ ...form, category_id: c.id })}
                  >
                    {c.name}
                  </Chip>
                ))}
              </View>
            </>
          )}

          <TextInput
            label="Date"
            value={form.expense_date}
            onChangeText={(v: string) => setForm({ ...form, expense_date: v })}
            mode="outlined"
            dense
            placeholder="YYYY-MM-DD"
            style={styles.input}
          />

          <TextInput
            label="Notes"
            value={form.notes}
            onChangeText={(v: string) => setForm({ ...form, notes: v })}
            mode="outlined"
            dense
            multiline
            numberOfLines={2}
            style={styles.input}
          />

          <View style={styles.actions}>
            <Button onPress={onDismiss}>Cancel</Button>
            <Button mode="contained" onPress={handleSubmit} loading={loading} disabled={!isValid}>
              {initialData ? 'Update' : 'Create'}
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: { backgroundColor: '#fff', margin: 16, padding: 20, borderRadius: 12, maxHeight: '90%' },
  title: { fontWeight: '700', marginBottom: 12 },
  input: { marginBottom: 8 },
  label: { color: '#6b7280', marginBottom: 4, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
});
