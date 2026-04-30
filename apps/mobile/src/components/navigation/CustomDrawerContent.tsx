import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { PlanName } from '@gustri/core';
import { PLAN_ORDER } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { StyleSheet, View } from 'react-native';
import { Badge, Divider, Text } from 'react-native-paper';
import { useMyOpenTasksCount } from '@/hooks/local';
import { useCafeSettings } from '@/hooks/shared';
import { useAuthStore } from '@/store/auth-store';
import type { DrawerParamList } from '@/types';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface DrawerSection {
  labelKey: string;
  items: {
    key: keyof DrawerParamList;
    labelKey: string;
    icon: IconName;
    roles: string[];
    minPlan?: PlanName;
  }[];
}

const DRAWER_SECTIONS: DrawerSection[] = [
  {
    labelKey: 'mainSection',
    items: [
      {
        key: 'Home',
        labelKey: 'tables',
        icon: 'table-furniture',
        roles: ['waiter', 'admin', 'owner', 'kitchen'],
      },
      {
        key: 'DeliveryTab',
        labelKey: 'delivery',
        icon: 'moped',
        roles: ['waiter', 'admin', 'owner', 'kitchen'],
      },
      {
        key: 'TakeoutTab',
        labelKey: 'takeout',
        icon: 'shopping',
        roles: ['waiter', 'admin', 'owner', 'kitchen'],
      },
      {
        key: 'TasksTab',
        labelKey: 'tasks',
        icon: 'checkbox-marked-outline',
        roles: ['waiter', 'admin', 'owner', 'kitchen'],
        minPlan: 'pro',
      },
    ],
  },
  {
    labelKey: 'managementSection',
    items: [
      {
        key: 'FeedbackTab',
        labelKey: 'feedback',
        icon: 'message-star',
        roles: ['admin', 'owner'],
      },
      {
        key: 'StockTab',
        labelKey: 'stock',
        icon: 'package-variant',
        roles: ['admin', 'owner'],
        minPlan: 'pro',
      },
      {
        key: 'WasteTab',
        labelKey: 'waste',
        icon: 'delete-variant',
        roles: ['admin', 'owner'],
        minPlan: 'pro',
      },
      {
        key: 'ExpensesTab',
        labelKey: 'expenses',
        icon: 'cash-register',
        roles: ['admin', 'owner'],
      },
    ],
  },
  {
    labelKey: 'adminSection',
    items: [
      {
        key: 'StaffManagementTab',
        labelKey: 'staff',
        icon: 'account-group',
        roles: ['admin', 'owner'],
      },
      { key: 'MenuManagementTab', labelKey: 'menu', icon: 'food', roles: ['admin', 'owner'] },
      {
        key: 'SchedulesTab',
        labelKey: 'schedules',
        icon: 'calendar-clock',
        roles: ['admin', 'owner'],
        minPlan: 'pro',
      },
      { key: 'ReportsTab', labelKey: 'reports', icon: 'chart-bar', roles: ['owner'] },
      {
        key: 'CafeSettingsTab',
        labelKey: 'cafeSettings',
        icon: 'store',
        roles: ['admin', 'owner'],
      },
    ],
  },
];

export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const staff = useAuthStore((s) => s.staff);
  const tenantPlan = useAuthStore((s) => s.tenantPlan) ?? 'free';
  const { data: cafeSettings } = useCafeSettings();
  const role = staff?.role || 'waiter';
  const currentRoute = props.state.routes[props.state.index]?.name;
  const myOpenCount = useMyOpenTasksCount(staff?.id);
  const { t: tNav } = useTranslation('nav');
  const { t: tRoles } = useTranslation('roles');

  return (
    <DrawerContentScrollView {...props} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="account-circle" size={48} color="#6366f1" />
        <View style={styles.headerInfo}>
          <Text variant="titleMedium" style={styles.headerName}>
            {staff?.full_name || tRoles('staff')}
          </Text>
          <Text variant="bodySmall" style={styles.headerRole}>
            {tRoles(role)}
          </Text>
        </View>
      </View>
      <Divider style={styles.divider} />

      {DRAWER_SECTIONS.map((section) => {
        const visibleItems = section.items.filter((item) => {
          if (!item.roles.includes(role)) return false;
          if (item.minPlan && PLAN_ORDER[tenantPlan] < PLAN_ORDER[item.minPlan]) return false;
          if (item.key === 'WasteTab' && !cafeSettings?.waste_tracking_enabled) return false;
          return true;
        });
        if (visibleItems.length === 0) return null;

        return (
          <View key={section.labelKey}>
            <Text variant="labelSmall" style={styles.sectionLabel}>
              {tNav(section.labelKey).toUpperCase()}
            </Text>
            {visibleItems.map((item) => (
              <DrawerItem
                key={item.key}
                label={({ color }) => (
                  <View style={styles.drawerLabel}>
                    <Text style={[styles.drawerLabelText, { color }]}>{tNav(item.labelKey)}</Text>
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
