import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ORDER_STATUS_KEYS } from '@gustri/core';
import { useLocale, useTranslation } from '@gustri/i18n';
import { ErrorScreen, LoadingScreen } from '@gustri/ui-mobile';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Modal, Portal, Text } from 'react-native-paper';
import { useCurrencySymbol, useOrders, useUpdateStaff } from '@/hooks/local';
import { usePaymentsByStaff, useStaffMember } from '@/hooks/shared';
import { useCanPerform } from '@/hooks/use-can-perform';
import { useSnackbar } from '@/hooks/use-snackbar';
import { TextInput } from '@/lib/paper-compat';
import { COLORS, ROLE_COLORS } from '@/theme';
import type { Order, OrderPayment, Staff, StaffManagementStackParamList } from '@/types';

type Route = RouteProp<StaffManagementStackParamList, 'StaffDetail'>;

const ROLES_ALL: Staff['role'][] = ['waiter', 'kitchen', 'admin', 'owner'];
const ROLES_NO_OWNER: Staff['role'][] = ['waiter', 'kitchen', 'admin'];

export default function StaffDetailScreen() {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const locale = useLocale();
  const route = useRoute<Route>();
  const { staffId } = route.params;
  const canGrantOwnerRole = useCanPerform('grant_owner_role');
  const { showSuccess, showError } = useSnackbar();

  const { data: member, isLoading, error, refetch } = useStaffMember(staffId);
  const { data: payments } = usePaymentsByStaff(staffId, 10);
  const { data: staffOrders } = useOrders({
    assigned_waiter_id: staffId,
    limit: 10,
  });
  const updateStaff = useUpdateStaff();

  const currencySymbol = useCurrencySymbol();

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<{
    full_name: string;
    phone: string;
    role: Staff['role'];
  }>({ full_name: '', phone: '', role: 'waiter' });

  const totalRevenue = useMemo(() => {
    return (
      payments?.reduce(
        (sum: number, p: Pick<OrderPayment, 'amount'>) => sum + (p.amount || 0),
        0,
      ) || 0
    );
  }, [payments]);

  const openEdit = () => {
    if (member) {
      setEditForm({
        full_name: member.full_name || '',
        phone: member.phone || '',
        role: member.role,
      });
      setShowEditModal(true);
    }
  };

  const handleSave = async () => {
    try {
      await updateStaff.mutateAsync({ id: staffId, data: editForm });
      showSuccess(t('staffMgmt.staffUpdated'));
      setShowEditModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('staffMgmt.failedUpdate');
      showError(message);
    }
  };

  if (isLoading) return <LoadingScreen />;
  if (error || !member)
    return <ErrorScreen error={error || t('staffMgmt.staffNotFound')} onRetry={refetch} />;

  const roleColors = ROLE_COLORS[member.role] || { bg: '#f3f4f6', text: '#374151' };
  const editableRoles = canGrantOwnerRole ? ROLES_ALL : ROLES_NO_OWNER;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <Card style={styles.card}>
        <Card.Content style={styles.profileContent}>
          <MaterialCommunityIcons name="account-circle" size={64} color={roleColors.text} />
          <Text variant="headlineSmall" style={styles.name}>
            {member.full_name}
          </Text>
          <Chip
            compact
            style={[styles.roleChip, { backgroundColor: roleColors.bg }]}
            textStyle={{ color: roleColors.text, fontWeight: '600' }}
          >
            {t(`staffMgmt.role.${member.role}`)}
          </Chip>
          <Text variant="bodyMedium" style={styles.muted}>
            {member.email}
          </Text>
          {member.phone && (
            <Text variant="bodySmall" style={styles.muted}>
              {member.phone}
            </Text>
          )}
          <Text variant="bodySmall" style={styles.muted}>
            {t('staffMgmt.memberSince')} {new Date(member.created_at).toLocaleDateString(locale)}
          </Text>
          <Button mode="outlined" onPress={openEdit} style={styles.editBtn}>
            {t('staffMgmt.editProfile')}
          </Button>
        </Card.Content>
      </Card>

      {/* Performance Stats */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {t('staffMgmt.performance')}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text variant="titleLarge" style={styles.statValue}>
                {staffOrders?.length || 0}
              </Text>
              <Text variant="bodySmall" style={styles.muted}>
                {t('staffMgmt.orders')}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text variant="titleLarge" style={styles.statValue}>
                {currencySymbol}
                {totalRevenue.toFixed(0)}
              </Text>
              <Text variant="bodySmall" style={styles.muted}>
                {t('staffMgmt.revenue')}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text variant="titleLarge" style={styles.statValue}>
                {payments?.length || 0}
              </Text>
              <Text variant="bodySmall" style={styles.muted}>
                {t('staffMgmt.payments')}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Recent Orders */}
      {(staffOrders?.length ?? 0) > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {t('staffMgmt.recentOrders')}
            </Text>
            {staffOrders?.map((o: Pick<Order, 'id' | 'order_number' | 'status'>) => (
              <View key={o.id} style={styles.listItem}>
                <Text variant="bodyMedium">#{o.order_number || '--'}</Text>
                <Text variant="bodySmall" style={styles.muted}>
                  {t(ORDER_STATUS_KEYS[o.status] || o.status)}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Recent Payments */}
      {(payments?.length ?? 0) > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {t('staffMgmt.recentPayments')}
            </Text>
            {payments?.map(
              (p: Pick<OrderPayment, 'id' | 'payment_method' | 'amount' | 'created_at'>) => (
                <View key={p.id} style={styles.listItem}>
                  <Text variant="bodyMedium">
                    {tCommon(p.payment_method)} — {currencySymbol}
                    {p.amount?.toFixed(2)}
                  </Text>
                  <Text variant="bodySmall" style={styles.muted}>
                    {new Date(p.created_at).toLocaleDateString(locale)}
                  </Text>
                </View>
              ),
            )}
          </Card.Content>
        </Card>
      )}

      {/* Edit Modal */}
      <Portal>
        <Modal
          visible={showEditModal}
          onDismiss={() => setShowEditModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 12 }}>
            {t('staffMgmt.editStaff')}
          </Text>
          <TextInput
            label={t('staffMgmt.fullName')}
            value={editForm.full_name}
            onChangeText={(v: string) => setEditForm({ ...editForm, full_name: v })}
            mode="outlined"
            dense
            style={styles.input}
          />
          <TextInput
            label={t('staffMgmt.phone')}
            value={editForm.phone}
            onChangeText={(v: string) => setEditForm({ ...editForm, phone: v })}
            mode="outlined"
            keyboardType="phone-pad"
            dense
            style={styles.input}
          />
          <Text variant="bodySmall" style={[styles.muted, { marginBottom: 4 }]}>
            {t('staffMgmt.role')}
          </Text>
          <View style={styles.chipRow}>
            {editableRoles.map((r) => (
              <Chip
                key={r}
                selected={editForm.role === r}
                onPress={() => setEditForm({ ...editForm, role: r })}
                compact
              >
                {t(`staffMgmt.role.${r}`)}
              </Chip>
            ))}
          </View>
          <View style={styles.modalActions}>
            <Button onPress={() => setShowEditModal(false)}>{t('staffMgmt.cancel')}</Button>
            <Button
              mode="contained"
              onPress={handleSave}
              loading={updateStaff.isPending}
              disabled={updateStaff.isPending}
            >
              {t('staffMgmt.save')}
            </Button>
          </View>
        </Modal>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {},
  profileContent: { alignItems: 'center', gap: 4 },
  name: { fontWeight: '700', color: COLORS.textPrimary, marginTop: 8 },
  roleChip: {},
  editBtn: { marginTop: 8 },
  sectionTitle: { fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { fontWeight: '700', color: COLORS.textPrimary },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modal: { backgroundColor: COLORS.card, margin: 20, padding: 20, borderRadius: 12 },
  input: { marginBottom: 8 },
  chipRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  muted: { color: COLORS.textMuted },
});
