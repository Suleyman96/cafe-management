import { createStackNavigator } from '@react-navigation/stack';
import { DrawerMenuButton } from '@/components/navigation/DrawerMenuButton';
import MenuManagementScreen from '@/screens/menu-management/MenuManagementScreen';
import type { MenuManagementStackParamList } from '@/types';

const Stack = createStackNavigator<MenuManagementStackParamList>();

export function MenuManagementStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MenuManagement"
        component={MenuManagementScreen}
        options={{ title: 'Menu Management', headerLeft: () => <DrawerMenuButton /> }}
      />
    </Stack.Navigator>
  );
}
