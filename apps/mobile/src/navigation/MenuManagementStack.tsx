import { createStackNavigator } from '@react-navigation/stack';
import MenuManagementScreen from '@/screens/menu-management/MenuManagementScreen';
import type { MenuManagementStackParamList } from '@/types';

const Stack = createStackNavigator<MenuManagementStackParamList>();

export function MenuManagementStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MenuManagement"
        component={MenuManagementScreen}
        options={{ title: 'Menu Management' }}
      />
    </Stack.Navigator>
  );
}
