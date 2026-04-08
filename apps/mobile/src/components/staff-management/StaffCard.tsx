import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@gustri/i18n';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, Text } from 'react-native-paper';

export const ROLE_COLORS: Record<string, string> = {
  owner: '#8b5cf6',
  admin: '#367B8B',
  waiter: '#10b981',
  kitchen: '#f59e0b',
};

interface StaffCardProps {
  staff: {
    id: string;
    full_name: string;
    email?: string | null;
    role: string;
    is_active?: boolean;
    phone?: string | null;
  };
  onPress: (id: string) => void;
}

export const StaffCard = React.memo(function StaffCard({ staff, onPress }: StaffCardProps) {
  const { t } = useTranslation('staff');
  const roleColor = ROLE_COLORS[staff.role] || '#6b7280';

  return (
    <Card style={styles.card} onPress={() => onPress(staff.id)}>
      <Card.Content style={styles.content}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="account-circle" size={40} color={roleColor} />
          <View style={styles.info}>
            <Text variant="titleSmall" style={styles.name}>
              {staff.full_name}
            </Text>
            {staff.email && (
              <Text variant="bodySmall" style={styles.muted}>
                {staff.email}
              </Text>
            )}
          </View>
          <View style={styles.badges}>
            <Chip
              compact
              style={[styles.roleChip, { backgroundColor: roleColor }]}
              textStyle={{ color: '#fff', fontSize: 10, fontWeight: '600' }}
            >
              {t(`staffMgmt.role.${staff.role}`, { defaultValue: staff.role })}
            </Chip>
            {staff.is_active === false && (
              <Chip compact textStyle={{ fontSize: 10, color: '#ef4444' }}>
                {t('staffMgmt.inactive')}
              </Chip>
            )}
          </View>
        </View>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 8 },
  content: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1, gap: 2 },
  name: { fontWeight: '600', color: '#1e293b' },
  muted: { color: '#6b7280' },
  badges: { alignItems: 'flex-end', gap: 4 },
  roleChip: {},
});
