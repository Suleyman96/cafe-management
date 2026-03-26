import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Modal, Portal, Text } from 'react-native-paper';
import { TextInput } from '@/lib/paper-compat';

const MOVEMENT_TYPES = [
  { value: 'in', label: '+ Add', color: '#10b981', bg: '#d1fae5' },
  { value: 'out', label: '- Remove', color: '#ef4444', bg: '#fee2e2' },
  { value: 'adjustment', label: 'Set To', color: '#3b82f6', bg: '#dbeafe' },
] as const;

interface StockMovementModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (data: {
    type: 'in' | 'out' | 'adjustment';
    quantity: number;
    reason?: string;
  }) => void;
  loading?: boolean;
  item?: {
    name: string;
    quantity: number;
    unit?: string | null;
  };
}

export function StockMovementModal({
  visible,
  onDismiss,
  onSubmit,
  loading,
  item,
}: StockMovementModalProps) {
  const [type, setType] = useState<'in' | 'out' | 'adjustment'>('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const qty = Number.parseFloat(quantity) || 0;
  const currentQty = item?.quantity ?? 0;
  const unit = item?.unit || 'units';

  const getNewQuantity = () => {
    if (type === 'in') return currentQty + qty;
    if (type === 'out') return currentQty - qty;
    return qty;
  };

  const newQty = getNewQuantity();
  const isInvalid = type === 'out' && qty > currentQty;

  const handleSubmit = () => {
    if (qty <= 0 || isInvalid) return;
    onSubmit({ type, quantity: qty, reason: reason || undefined });
    setQuantity('');
    setReason('');
    setType('in');
  };

  const handleDismiss = () => {
    setQuantity('');
    setReason('');
    setType('in');
    onDismiss();
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={handleDismiss} contentContainerStyle={styles.modal}>
        <Text variant="titleMedium" style={styles.title}>
          Adjust Stock{item ? `: ${item.name}` : ''}
        </Text>

        {/* Current Stock */}
        <Card style={styles.currentCard}>
          <Card.Content style={styles.currentContent}>
            <Text variant="bodySmall" style={styles.currentLabel}>
              Current Stock
            </Text>
            <Text variant="headlineSmall" style={styles.currentValue}>
              {currentQty} {unit}
            </Text>
          </Card.Content>
        </Card>

        {/* Movement Type */}
        <Text variant="bodySmall" style={styles.label}>
          Movement Type
        </Text>
        <View style={styles.typeRow}>
          {MOVEMENT_TYPES.map((mt) => (
            <Chip
              key={mt.value}
              compact
              selected={type === mt.value}
              onPress={() => setType(mt.value)}
              style={type === mt.value ? { backgroundColor: mt.bg } : undefined}
              textStyle={type === mt.value ? { color: mt.color, fontWeight: '700' } : undefined}
            >
              {mt.label}
            </Chip>
          ))}
        </View>

        {/* Quantity */}
        <TextInput
          label={type === 'adjustment' ? 'New Quantity' : 'Quantity'}
          value={quantity}
          onChangeText={setQuantity}
          mode="outlined"
          keyboardType="decimal-pad"
          dense
          style={styles.input}
          error={isInvalid}
        />
        {isInvalid && (
          <Text variant="bodySmall" style={styles.errorText}>
            Cannot remove more than available ({currentQty})
          </Text>
        )}

        {/* New Stock Preview */}
        {qty > 0 && !isInvalid && (
          <Card style={styles.previewCard}>
            <Card.Content style={styles.previewContent}>
              <Text variant="bodySmall" style={styles.previewLabel}>
                New Stock Level
              </Text>
              <Text variant="titleLarge" style={styles.previewValue}>
                {newQty.toFixed(2)} {unit}
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Reason */}
        <TextInput
          label="Reason (optional)"
          value={reason}
          onChangeText={setReason}
          mode="outlined"
          dense
          style={styles.input}
        />

        <View style={styles.actions}>
          <Button onPress={handleDismiss}>Cancel</Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={qty <= 0 || isInvalid}
          >
            Confirm
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: { backgroundColor: '#fff', margin: 16, padding: 20, borderRadius: 12 },
  title: { fontWeight: '700', marginBottom: 12 },
  label: { color: '#6b7280', marginBottom: 4, marginTop: 4 },
  input: { marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  currentCard: { backgroundColor: '#f9fafb', marginBottom: 12 },
  currentContent: { alignItems: 'center' },
  currentLabel: { color: '#6b7280' },
  currentValue: { fontWeight: '700', color: '#1e293b' },
  previewCard: { backgroundColor: '#eff6ff', marginBottom: 8 },
  previewContent: { alignItems: 'center' },
  previewLabel: { color: '#3b82f6' },
  previewValue: { fontWeight: '700', color: '#1e40af' },
  errorText: { color: '#ef4444', marginBottom: 8, marginTop: -4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
});
