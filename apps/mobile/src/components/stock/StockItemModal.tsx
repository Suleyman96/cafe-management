import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Modal, Portal, Text } from 'react-native-paper';
import { TextInput } from '@/lib/paper-compat';

const UNITS = ['pieces', 'kg', 'liters', 'boxes', 'bags', 'bottles', 'packs'];
const CATEGORIES = [
  'Beverages',
  'Food Supplies',
  'Cleaning Supplies',
  'Equipment',
  'Packaging',
  'Dairy',
  'Produce',
  'Meat',
  'Dry Goods',
  'Other',
];

interface StockItemModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (data: any) => void;
  loading?: boolean;
  initialData?: any;
  currencySymbol?: string;
}

export function StockItemModal({
  visible,
  onDismiss,
  onSubmit,
  loading,
  initialData,
  currencySymbol = '$',
}: StockItemModalProps) {
  const isEdit = !!initialData;

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'Other',
    quantity: '0',
    unit: 'pieces',
    cost_price: '0',
    minimum_stock_level: '0',
    supplier_name: '',
    notes: '',
  });

  useEffect(() => {
    if (!visible) return;
    if (initialData) {
      setForm({
        name: initialData.name || '',
        description: initialData.description || '',
        category: initialData.category || 'Other',
        quantity: String(initialData.quantity ?? 0),
        unit: initialData.unit || 'pieces',
        cost_price: String(initialData.cost_price ?? 0),
        minimum_stock_level: String(initialData.minimum_stock_level ?? 0),
        supplier_name: initialData.supplier_name || '',
        notes: initialData.notes || '',
      });
    } else {
      setForm({
        name: '',
        description: '',
        category: 'Other',
        quantity: '0',
        unit: 'pieces',
        cost_price: '0',
        minimum_stock_level: '0',
        supplier_name: '',
        notes: '',
      });
    }
  }, [visible, initialData]);

  const handleSubmit = () => {
    onSubmit({
      name: form.name,
      description: form.description || null,
      category: form.category,
      quantity: Number.parseFloat(form.quantity) || 0,
      unit: form.unit,
      cost_price: Number.parseFloat(form.cost_price) || 0,
      minimum_stock_level: Number.parseFloat(form.minimum_stock_level) || 0,
      supplier_name: form.supplier_name || null,
      notes: form.notes || null,
      is_active: true,
    });
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        <ScrollView>
          <Text variant="titleMedium" style={styles.title}>
            {isEdit ? 'Edit Stock Item' : 'New Stock Item'}
          </Text>

          <TextInput
            label="Name *"
            value={form.name}
            onChangeText={(v: string) => setForm({ ...form, name: v })}
            mode="outlined"
            dense
            style={styles.input}
          />

          <TextInput
            label="Description"
            value={form.description}
            onChangeText={(v: string) => setForm({ ...form, description: v })}
            mode="outlined"
            dense
            multiline
            style={styles.input}
          />

          <Text variant="bodySmall" style={styles.label}>
            Category
          </Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((cat) => (
              <Chip
                key={cat}
                compact
                selected={form.category === cat}
                onPress={() => setForm({ ...form, category: cat })}
              >
                {cat}
              </Chip>
            ))}
          </View>

          <Text variant="bodySmall" style={styles.label}>
            Unit
          </Text>
          <View style={styles.chipRow}>
            {UNITS.map((u) => (
              <Chip
                key={u}
                compact
                selected={form.unit === u}
                onPress={() => setForm({ ...form, unit: u })}
              >
                {u}
              </Chip>
            ))}
          </View>

          <View style={styles.rowInputs}>
            {!isEdit && (
              <TextInput
                label="Initial Qty"
                value={form.quantity}
                onChangeText={(v: string) => setForm({ ...form, quantity: v })}
                mode="outlined"
                keyboardType="decimal-pad"
                dense
                style={[styles.input, styles.halfInput]}
              />
            )}
            <TextInput
              label={`Cost Price (${currencySymbol})`}
              value={form.cost_price}
              onChangeText={(v: string) => setForm({ ...form, cost_price: v })}
              mode="outlined"
              keyboardType="decimal-pad"
              dense
              style={[styles.input, isEdit ? styles.fullInput : styles.halfInput]}
            />
          </View>

          <TextInput
            label="Minimum Stock Level"
            value={form.minimum_stock_level}
            onChangeText={(v: string) => setForm({ ...form, minimum_stock_level: v })}
            mode="outlined"
            keyboardType="decimal-pad"
            dense
            style={styles.input}
          />

          <TextInput
            label="Supplier Name"
            value={form.supplier_name}
            onChangeText={(v: string) => setForm({ ...form, supplier_name: v })}
            mode="outlined"
            dense
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
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={!form.name.trim()}
            >
              {isEdit ? 'Update' : 'Create'}
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
  label: { color: '#6b7280', marginBottom: 4, marginTop: 4 },
  input: { marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  rowInputs: { flexDirection: 'row', gap: 8 },
  halfInput: { flex: 1 },
  fullInput: { flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
});
