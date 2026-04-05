import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { StyleSheet, View } from 'react-native';
import { Badge, Divider, Text } from 'react-native-paper';
import { useMyOpenTasksCount } from '@/hooks';
import { useAuthStore } from '@/store/auth-store';
import type { DrawerParamList } from '@/types';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface DrawerSection {
  label: string;
  items: {
    key: keyof DrawerParamList;
    label: string;
    icon: IconName;
    roles: string[];
  }[];
}

const DRAWER_SECTIONS: DrawerSection[] = [
  {
    label: 'Main',
    items: [
      { key: 'Home', label: 'Home', icon: 'home', roles: ['waiter', 'admin', 'owner', 'kitchen'] },
      { key: 'DeliveryTab', label: 'Delivery', icon: 'moped', roles: ['waiter', 'admin', 'owner'] },
      {
        key: 'TakeoutTab',
        label: 'Takeout',
        icon: 'shopping',
        roles: ['waiter', 'admin', 'owner'],
      },
      {
        key: 'TasksTab',
        label: 'Tasks',
        icon: 'checkbox-marked-outline',
        roles: ['waiter', 'admin', 'owner', 'kitchen'],
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        key: 'FeedbackTab',
        label: 'Feedback',
        icon: 'message-star',
        roles: ['waiter', 'admin', 'owner'],
      },
      { key: 'StockTab', label: 'Stock', icon: 'package-variant', roles: ['admin', 'owner'] },
      {
        key: 'WasteTab',
        label: 'Waste',
        icon: 'delete-variant',
        roles: ['waiter', 'admin', 'owner', 'kitchen'],
      },
      { key: 'ExpensesTab', label: 'Expenses', icon: 'cash-register', roles: ['admin', 'owner'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        key: 'StaffManagementTab',
        label: 'Staff',
        icon: 'account-group',
        roles: ['admin', 'owner'],
      },
      { key: 'MenuManagementTab', label: 'Menu', icon: 'food', roles: ['admin', 'owner'] },
      {
        key: 'SchedulesTab',
        label: 'Schedules',
        icon: 'calendar-clock',
        roles: ['admin', 'owner'],
      },
      { key: 'ReportsTab', label: 'Reports', icon: 'chart-bar', roles: ['owner'] },
      { key: 'CafeSettingsTab', label: 'Cafe Settings', icon: 'cog', roles: ['admin', 'owner'] },
    ],
  },
];

export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const staff = useAuthStore((s) => s.staff);
  const role = staff?.role || 'waiter';
  const currentRoute = props.state.routes[props.state.index]?.name;
  const myOpenCount = useMyOpenTasksCount(staff?.id);

  return (
    <DrawerContentScrollView {...props} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="account-circle" size={48} color="#6366f1" />
        <View style={styles.headerInfo}>
          <Text variant="titleMedium" style={styles.headerName}>
            {staff?.full_name || 'Staff'}
          </Text>
          <Text variant="bodySmall" style={styles.headerRole}>
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </Text>
        </View>
      </View>
      <Divider style={styles.divider} />

      {DRAWER_SECTIONS.map((section) => {
        const visibleItems = section.items.filter((item) => item.roles.includes(role));
        if (visibleItems.length === 0) return null;

        return (
          <View key={section.label}>
            <Text variant="labelSmall" style={styles.sectionLabel}>
              {section.label.toUpperCase()}
            </Text>
            {visibleItems.map((item) => (
              <DrawerItem
                key={item.key}
                label={({ color }) => (
                  <View style={styles.drawerLabel}>
                    <Text style={[styles.drawerLabelText, { color }]}>{item.label}</Text>
                    {item.key === 'TasksTab' && myOpenCount > 0 && (
                      <Badge size={20} style={styles.taskBadge}>
                        {myOpenCount}
                      </Badge>
                    )}
                  </View>
                )}
                focused={currentRoute === item.key}
                icon={({ color, size }: { color: string; size: number }) => (
                  <MaterialCommunityIcons name={item.icon} size={size} color={color} />
                )}
                onPress={() => props.navigation.navigate(item.key)}
                activeTintColor="#6366f1"
              />
            ))}
          </View>
        );
      })}
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontWeight: '700',
    color: '#1e293b',
  },
  headerRole: {
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  divider: {
    marginBottom: 8,
  },
  sectionLabel: {
    color: '#9ca3af',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  drawerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  drawerLabelText: {
    flex: 1,
    fontSize: 14,
  },
  taskBadge: {
    backgroundColor: '#6366f1',
  },
});
