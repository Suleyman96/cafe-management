import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Chip, Divider, List, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnackbar } from '@/hooks/use-snackbar';
import { logout } from '@/lib/auth';
import { cleanupSounds } from '@/lib/sound';
import { useAuthStore } from '@/store/auth-store';

const ROLE_COLORS: Record<string, string> = {
  admin: '#7c3aed',
  owner: '#dc2626',
  waiter: '#2563eb',
  kitchen: '#d97706',
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { staff, clearAuth } = useAuthStore();
  const { showError } = useSnackbar();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!staff) return null;

  const initials = (staff.full_name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await cleanupSounds();
      await logout();
      clearAuth();
    } catch (err: any) {
      showError(err?.message || 'Failed to sign out');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      {/* Avatar & Name */}
      <View style={styles.avatarSection}>
        <Avatar.Text size={80} label={initials} />
        <Text variant="headlineSmall" style={styles.name}>
          {staff.full_name}
        </Text>
        <Chip
          compact
          style={{ backgroundColor: ROLE_COLORS[staff.role] || '#6b7280' }}
          textStyle={{ color: '#fff', fontWeight: '600' }}
        >
          {staff.role.charAt(0).toUpperCase() + staff.role.slice(1)}
        </Chip>
      </View>

      {/* Info */}
      <Card style={styles.card}>
        <Card.Content>
          <List.Item
            title="Email"
            description={staff.email}
            left={(props) => <List.Icon {...props} icon="email" />}
          />
          <Divider />
          <List.Item
            title="Role"
            description={staff.role}
            left={(props) => <List.Icon {...props} icon="shield-account" />}
          />
          {staff.phone && (
            <>
              <Divider />
              <List.Item
                title="Phone"
                description={staff.phone}
                left={(props) => <List.Icon {...props} icon="phone" />}
              />
            </>
          )}
          {staff.last_login_at && (
            <>
              <Divider />
              <List.Item
                title="Last Login"
                description={new Date(staff.last_login_at).toLocaleString()}
                left={(props) => <List.Icon {...props} icon="clock-outline" />}
              />
            </>
          )}
        </Card.Content>
      </Card>

      <View style={styles.logoutSection}>
        <Button
          mode="outlined"
          onPress={handleLogout}
          loading={loggingOut}
          disabled={loggingOut}
          icon="logout"
          textColor="#ef4444"
          style={styles.logoutButton}
        >
          Sign Out
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  name: {
    fontWeight: '700',
    color: '#1e293b',
  },
  card: {
    marginHorizontal: 16,
  },
  logoutSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  logoutButton: {
    borderColor: '#ef4444',
  },
});
