import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Modal, Portal, Text } from 'react-native-paper';
import { ErrorScreen, LoadingScreen } from '@/components/ui';
import { useOrders, usePaymentsByStaff, useStaffMember, useUpdateStaff } from '@/hooks';
import { useCafeSettings } from '@/hooks/use-cafe-settings';
import { useSnackbar } from '@/hooks/use-snackbar';
import { TextInput } from '@/lib/paper-compat';
import type { Staff, StaffManagementStackParamList } from '@/types';

type Route = RouteProp<StaffManagementStackParamList, 'StaffDetail'>;

const ROLE_COLORS: Record<string, string> = {
  owner: '#8b5cf6',
  admin: '#3b82f6',
  waiter: '#10b981',
  kitchen: '#f59e0b',
};

export default function StaffDetailScreen() {
  const route = useRoute<Route>();
  const { staffId } = route.params;
  const { showSuccess, showError } = useSnackbar();

  const { data: member, isLoading, error, refetch } = useStaffMember(staffId);
  const { data: payments } = usePaymentsByStaff(staffId, 10);
  const { data: orders } = useOrders();
  const { data: settings } = useCafeSettings();
  const updateStaff = useUpdateStaff();

  const currencySymbol = settings?.currency_symbol || '$';

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<{
    full_name: string;
    phone: string;
    role: Staff['role'];
  }>({ full_name: '', phone: '', role: 'waiter' });

  const staffOrders = useMemo(() => {
    if (!orders || !staffId) return [];
    return orders
      .filter((o: { assigned_waiter_id: string | null }) => o.assigned_waiter_id === staffId)
      .slice(0, 10);
  }, [orders, staffId]);

  const totalRevenue = useMemo(() => {
    return payments?.reduce((sum: number, p: { amount: number }) => sum + (p.amount || 0), 0) || 0;
  }, [payments]);

  const openEdit = () => {
    if (member) {
      setEditForm({
        full_name: member.full_name || '',
        phone: member.phone || '',
        role: member.role || '',
      });
      setShowEditModal(true);
    }
  };

  const handleSave = async () => {
    try {
      await updateStaff.mutateAsync({ id: staffId, data: editForm });
      showSuccess('Staff updated');
      setShowEditModal(false);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  if (isLoading) return <LoadingScreen />;
  if (error || !member) return <ErrorScreen error={error || 'Staff not found'} onRetry={refetch} />;

  const roleColor = ROLE_COLORS[member.role] || '#6b7280';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <Card style={styles.card}>
        <Card.Content style={styles.profileContent}>
          <MaterialCommunityIcons name="account-circle" size={64} color={roleColor} />
          <Text variant="headlineSmall" style={styles.name}>
            {member.full_name}
          </Text>
          <Chip
            compact
            style={[styles.roleChip, { backgroundColor: roleColor }]}
            textStyle={{ color: '#fff', fontWeight: '600' }}
          >
            {member.role}
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
            Member since {new Date(member.created_at).toLocaleDateString()}
          </Text>
          <Button mode="outlined" onPress={openEdit} style={styles.editBtn}>
            Edit Profile
          </Button>
        </Card.Content>
      </Card>

      {/* Performance Stats */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Performance
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text variant="titleLarge" style={styles.statValue}>
                {staffOrders.length}
              </Text>
              <Text variant="bodySmall" style={styles.muted}>
                Orders
              </Text>
            </View>
            <View style={styles.stat}>
              <Text variant="titleLarge" style={styles.statValue}>
                {currencySymbol}
                {totalRevenue.toFixed(0)}
              </Text>
              <Text variant="bodySmall" style={styles.muted}>
                Revenue
              </Text>
            </View>
            <View style={styles.stat}>
              <Text variant="titleLarge" style={styles.statValue}>
                {payments?.length || 0}
              </Text>
              <Text variant="bodySmall" style={styles.muted}>
                Payments
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Recent Orders */}
      {staffOrders.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Recent Orders
            </Text>
            {staffOrders.map((o: { id: string; order_number: string | null; status: string }) => (
              <View key={o.id} style={styles.listItem}>
                <Text variant="bodyMedium">#{o.order_number || '--'}</Text>
                <Text variant="bodySmall" style={styles.muted}>
                  {o.status}
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
              Recent Payments
            </Text>
            {payments?.map(
              (p: { id: string; payment_method: string; amount: number; created_at: string }) => (
                <View key={p.id} style={styles.listItem}>
                  <Text variant="bodyMedium">
                    {p.payment_method} — {currencySymbol}
                    {p.amount?.toFixed(2)}
                  </Text>
                  <Text variant="bodySmall" style={styles.muted}>
                    {new Date(p.created_at).toLocaleDateString()}
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
            Edit Staff
          </Text>
          <TextInput
            label="Full Name"
            value={editForm.full_name}
            onChangeText={(v: string) => setEditForm({ ...editForm, full_name: v })}
            mode="outlined"
            dense
            style={styles.input}
          />
          <TextInput
            label="Phone"
            value={editForm.phone}
            onChangeText={(v: string) => setEditForm({ ...editForm, phone: v })}
            mode="outlined"
            keyboardType="phone-pad"
            dense
            style={styles.input}
          />
          <Text variant="bodySmall" style={[styles.muted, { marginBottom: 4 }]}>
            Role
          </Text>
          <View style={styles.chipRow}>
            {(['waiter', 'kitchen', 'admin'] as Staff['role'][]).map((r) => (
              <Chip
                key={r}
                selected={editForm.role === r}
                onPress={() => setEditForm({ ...editForm, role: r })}
                compact
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </Chip>
            ))}
          </View>
          <View style={styles.modalActions}>
            <Button onPress={() => setShowEditModal(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleSave} loading={updateStaff.isPending}>
              Save
            </Button>
          </View>
        </Modal>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {},
  profileContent: { alignItems: 'center', gap: 4 },
  name: { fontWeight: '700', color: '#1e293b', marginTop: 8 },
  roleChip: {},
  editBtn: { marginTop: 8 },
  sectionTitle: { fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { fontWeight: '700', color: '#1e293b' },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modal: { backgroundColor: '#fff', margin: 20, padding: 20, borderRadius: 12 },
  input: { marginBottom: 8 },
  chipRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  muted: { color: '#6b7280' },
});
