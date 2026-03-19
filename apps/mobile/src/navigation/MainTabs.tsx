import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from 'react-native-paper';
import { useAuthStore } from '@/store/auth-store';
import type { MainTabParamList } from '@/types';
import { CallsStack } from './CallsStack';
import { KitchenStack } from './KitchenStack';
import { OrdersStack } from './OrdersStack';
import { ProfileStack } from './ProfileStack';
import { TablesStack } from './TablesStack';

const Tab = createBottomTabNavigator<MainTabParamList>();

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TAB_CONFIG: Record<
  keyof MainTabParamList,
  { label: string; icon: IconName; roles: string[] }
> = {
  TablesTab: { label: 'Tables', icon: 'table-furniture', roles: ['waiter', 'admin', 'owner'] },
  OrdersTab: {
    label: 'Orders',
    icon: 'clipboard-list',
    roles: ['waiter', 'admin', 'owner', 'kitchen'],
  },
  KitchenTab: { label: 'Kitchen', icon: 'chef-hat', roles: ['kitchen', 'admin', 'owner'] },
  CallsTab: { label: 'Calls', icon: 'bell-ring', roles: ['waiter', 'admin', 'owner'] },
  ProfileTab: { label: 'Profile', icon: 'account', roles: ['waiter', 'admin', 'owner', 'kitchen'] },
};

export function MainTabs() {
  const theme = useTheme();
  const staff = useAuthStore((s) => s.staff);
  const role = staff?.role || 'waiter';

  return (
    <Tab.Navigator
      initialRouteName={role === 'kitchen' ? 'KitchenTab' : 'TablesTab'}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceDisabled,
        tabBarStyle: {
          borderTopColor: theme.colors.outlineVariant,
        },
      }}
    >
      {(
        Object.entries(TAB_CONFIG) as [
          keyof MainTabParamList,
          (typeof TAB_CONFIG)[keyof MainTabParamList],
        ][]
      ).map(([name, config]) => {
        if (!config.roles.includes(role)) return null;
        return (
          <Tab.Screen
            key={name}
            name={name}
            component={getStackComponent(name)}
            options={{
              tabBarLabel: config.label,
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name={config.icon} size={size} color={color} />
              ),
            }}
          />
        );
      })}
    </Tab.Navigator>
  );
}

function getStackComponent(name: keyof MainTabParamList) {
  switch (name) {
    case 'TablesTab':
      return TablesStack;
    case 'OrdersTab':
      return OrdersStack;
    case 'KitchenTab':
      return KitchenStack;
    case 'CallsTab':
      return CallsStack;
    case 'ProfileTab':
      return ProfileStack;
  }
}
