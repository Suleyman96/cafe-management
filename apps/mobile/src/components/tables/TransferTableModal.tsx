import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ACTIVE_ORDER_STATUSES } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Divider, Portal, RadioButton } from 'react-native-paper';
import { StatusBadge } from '@/components/ui';
import { useOrders, useTables } from '@/hooks/local';
import { useTransferTable } from '@/hooks/shared';
import { useSnackbar } from '@/hooks/use-snackbar';
import { Text, TextInput } from '@/lib/paper-compat';
import { useAuthStore } from '@/store/auth-store';
import { COLORS } from '@/theme';
import type { Order, Table } from '@/types';

interface TransferTableModalProps {
  visible: boolean;
  sourceTable: Pick<Table, 'id' | 'table_number'>;
  onDismiss: () => void;
  onSuccess: () => void;
}

export const TransferTableModal = React.memo(function TransferTableModal({
  visible,
  sourceTable,
  onDismiss,
  onSuccess,
}: TransferTableModalProps) {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const staffId = useAuthStore((s) => s.staff?.id ?? null);
  const { showError } = useSnackbar();

  const { data: tables } = useTables();
  // Only inspect active orders. Keeps the payload small on busy floors and
  // matches the staff-web modal's behavior — pending_approval is intentionally
  // included so a QR order awaiting kitchen approval still gets moved with
  // the party when they switch tables.
  const { data: orders } = useOrders({
    statuses: ACTIVE_ORDER_STATUSES as unknown as Order['status'][],
    limit: 200,
  });
  const transferTable = useTransferTable();

  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Every active order anchored to this table gets moved as a unit — a party
  // moving tables shouldn't leave a half-checked-out order behind on the old
  // one.
  const activeOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(
      (o) =>
        o.table_id === sourceTable.id &&
        (ACTIVE_ORDER_STATUSES as readonly string[]).includes(o.status),
    );
  }, [orders, sourceTable.id]);

  // Free tables first, then reserved, then occupied — same sort web uses so
  // mobile users see the same suggested order.
  const availableTables = useMemo(() => {
    if (!tables) return [];
    const statusOrder: Record<string, number> = { free: 0, reserved: 1, occupied: 2, closed: 3 };
    return tables
      .filter((tbl) => tbl.id !== sourceTable.id)
      .sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
  }, [tables, sourceTable.id]);

  const selectedTable = useMemo(
    () => availableTables.find((tbl) => tbl.id === selectedTableId),
    [availableTables, selectedTableId],
  );
  const targetOccupied = selectedTable?.status === 'occupied';

  const reset = () => {
    setSelectedTableId('');
    setReason('');
  };

  const handleDismiss = () => {
    if (submitting) return;
    reset();
    onDismiss();
  };

  const handleTransfer = async () => {
    if (!selectedTableId || activeOrders.length === 0 || !staffId) return;
    setSubmitting(true);
    let succeeded = 0;
    try {
      // Sequential mutates rather than Promise.all — the RPC takes a table-lock
      // and parallel calls against the same source/target deadlock under load.
      for (const order of activeOrders) {
        await transferTable.mutateAsync({
          orderId: order.id,
          fromTableId: sourceTable.id,
          toTableId: selectedTableId,
          staffId,
          reason: reason.trim() || undefined,
        });
        succeeded++;
      }
      reset();
      onSuccess();
    } catch (err: unknown) {
      // Partial success message matches the web modal — staff need to know
      // which orders moved and which still need attention.
      if (succeeded > 0) {
        showError(t('tables.partialTransferError', { succeeded, total: activeOrders.length }));
      } else {
        showError(err instanceof Error ? err : t('tables.failedTransfer'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisabled = !selectedTableId || activeOrders.length === 0 || submitting || !staffId;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleDismiss} style={styles.dialog}>
        <Dialog.Title style={styles.title}>
          {t('tables.transferTable', { table: sourceTable.table_number })}
        </Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView>
            <View style={styles.body}>
              <Text variant="bodySmall" style={styles.label}>
                {t('tables.transferToTable')}
              </Text>

              {availableTables.length === 0 ? (
                <Text variant="bodyMedium" style={styles.muted}>
                  {t('tables.selectTable')}
                </Text>
              ) : (
                <RadioButton.Group onValueChange={setSelectedTableId} value={selectedTableId}>
                  {availableTables.map((tbl) => (
                    <View key={tbl.id} style={styles.tableRow}>
                      <RadioButton.Android value={tbl.id} />
                      <View style={styles.tableInfo}>
                        <Text variant="bodyMedium" style={styles.tableLabel}>
                          {t('tables.tableHash', { number: tbl.table_number })}
                          {tbl.location ? ` — ${tbl.location}` : ''}
                        </Text>
                        <View style={styles.tableMeta}>
                          <StatusBadge status={tbl.status} type="table" />
                          {tbl.capacity != null && (
                            <Text variant="bodySmall" style={styles.muted}>
                              {t('tables.capacity')}: {tbl.capacity} {t('tables.seats')}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </RadioButton.Group>
              )}

              {targetOccupied && (
                <View style={styles.warning}>
                  <MaterialCommunityIcons
                    name="alert"
                    size={18}
                    color="#b45309"
                    style={styles.warningIcon}
                  />
                  <View style={styles.warningText}>
                    <Text variant="bodyMedium" style={styles.warningTitle}>
                      {t('tables.tableOccupied')}
                    </Text>
                    <Text variant="bodySmall" style={styles.warningBody}>
                      {t('tables.occupiedWarning')}
                    </Text>
                  </View>
                </View>
              )}

              <Divider style={styles.divider} />

              <TextInput
                label={t('tables.reasonOptional')}
                value={reason}
                onChangeText={setReason}
                mode="outlined"
                placeholder={t('tables.transferReasonExamples')}
              />
            </View>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={handleDismiss} disabled={submitting}>
            {tCommon('cancel')}
          </Button>
          <Button
            mode="contained"
            onPress={handleTransfer}
            disabled={submitDisabled}
            loading={submitting}
            buttonColor={targetOccupied ? COLORS.warning : undefined}
            textColor={targetOccupied ? '#000' : undefined}
          >
            {submitting
              ? t('tables.transferring')
              : targetOccupied
                ? t('tables.transferAnyway')
                : t('tables.transferTableBtn')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
});

const styles = StyleSheet.create({
  dialog: { maxHeight: '90%' },
  title: { paddingBottom: 0 },
  scrollArea: { paddingHorizontal: 0 },
  body: { gap: 12, paddingHorizontal: 24, paddingVertical: 12 },
  label: { color: COLORS.textSecondary, fontWeight: '600', marginTop: 4 },
  muted: { color: COLORS.textMuted },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  tableInfo: { flex: 1 },
  tableLabel: { color: COLORS.textPrimary, fontWeight: '600' },
  tableMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
    borderWidth: 1,
    borderRadius: 8,
  },
  warningIcon: { marginTop: 2 },
  warningText: { flex: 1 },
  warningTitle: { color: '#92400e', fontWeight: '700' },
  warningBody: { color: '#b45309', marginTop: 2 },
  divider: { marginVertical: 4 },
});
