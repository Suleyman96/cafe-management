import { useTranslation } from '@gustri/i18n';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Modal, Portal, Text } from 'react-native-paper';
import { OfflineGuardButton } from '@/components/OfflineGuardButton';
import { TextInput } from '@/lib/paper-compat';
import { BRAND_PRIMARY, COLORS } from '@/theme';

const MOVEMENT_TYPES = [
  { value: 'in', labelKey: 'stock.addPlus', color: COLORS.success, bg: '#d1fae5' },
  { value: 'out', labelKey: 'stock.removeMinus', color: COLORS.danger, bg: '#fee2e2' },
  { value: 'adjustment', labelKey: 'stock.setTo', color: BRAND_PRIMARY, bg: '#dbeafe' },
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
  initialType?: 'in' | 'out' | 'adjustment';
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
  initialType = 'in',
  item,
}: StockMovementModalProps) {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const [type, setType] = useState<'in' | 'out' | 'adjustment'>(initialType);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) {
      setType(initialType);
      setQuantity('');
      setReason('');
    }
  }, [visible, initialType]);

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
  };

  const handleDismiss = () => {
    onDismiss();
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={handleDismiss} contentContainerStyle={styles.modal}>
        <Text variant="titleMedium" style={styles.title}>
          {t('stock.adjustStock')}
          {item ? `: ${item.name}` : ''}
        </Text>

        {/* Current Stock */}
        <Card style={styles.currentCard}>
          <Card.Content style={styles.currentContent}>
            <Text variant="bodySmall" style={styles.currentLabel}>
              {t('stock.currentStock')}
            </Text>
            <Text variant="headlineSmall" style={styles.currentValue}>
              {currentQty} {unit}
            </Text>
          </Card.Content>
        </Card>

        {/* Movement Type */}
        <Text variant="bodySmall" style={styles.label}>
          {t('stock.movementType')}
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
              {t(mt.labelKey)}
            </Chip>
          ))}
        </View>

        {/* Quantity */}
        <TextInput
          label={type === 'adjustment' ? t('stock.newQuantity') : t('stock.quantityLabel')}
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
            {t('stock.cannotRemoveMore')} ({currentQty})
          </Text>
        )}

        {/* New Stock Preview */}
        {qty > 0 && !isInvalid && (
          <Card style={styles.previewCard}>
            <Card.Content style={styles.previewContent}>
              <Text variant="bodySmall" style={styles.previewLabel}>
                {t('stock.newStockLevel')}
              </Text>
              <Text variant="titleLarge" style={styles.previewValue}>
                {Number.isNaN(newQty) ? '0.00' : newQty.toFixed(2)} {unit}
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Reason */}
        <TextInput
          label={t('stock.reasonOptional')}
          value={reason}
          onChangeText={setReason}
          mode="outlined"
          dense
          style={styles.input}
        />

        <View style={styles.actions}>
          <Button onPress={handleDismiss}>{tCommon('cancel')}</Button>
          <OfflineGuardButton
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={qty <= 0 || isInvalid}
            offlineLabel={t('stock.offlineUnavailable')}
          >
            {tCommon('confirm')}
          </OfflineGuardButton>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: { backgroundColor: COLORS.card, margin: 16, padding: 20, borderRadius: 12 },
  title: { fontWeight: '700', marginBottom: 12 },
  label: { color: COLORS.textMuted, marginBottom: 4, marginTop: 4 },
  input: { marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  currentCard: { backgroundColor: COLORS.background, marginBottom: 12 },
  currentContent: { alignItems: 'center' },
  currentLabel: { color: COLORS.textMuted },
  currentValue: { fontWeight: '700', color: COLORS.textPrimary },
  previewCard: { backgroundColor: '#eff6ff', marginBottom: 8 },
  previewContent: { alignItems: 'center' },
  previewLabel: { color: BRAND_PRIMARY },
  previewValue: { fontWeight: '700', color: '#1e40af' },
  errorText: { color: COLORS.danger, marginBottom: 8, marginTop: -4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
});
