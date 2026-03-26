import { createStackNavigator } from '@react-navigation/stack';
import { DrawerMenuButton } from '@/components/navigation/DrawerMenuButton';
import StaffDetailScreen from '@/screens/staff-management/StaffDetailScreen';
import StaffListScreen from '@/screens/staff-management/StaffListScreen';
import type { StaffManagementStackParamList } from '@/types';

const Stack = createStackNavigator<StaffManagementStackParamList>();

export function StaffManagementStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="StaffList"
        component={StaffListScreen}
        options={{ title: 'Staff', headerLeft: () => <DrawerMenuButton /> }}
      />
      <Stack.Screen
        name="StaffDetail"
        component={StaffDetailScreen}
        options={{ title: 'Staff Detail' }}
      />
    </Stack.Navigator>
  );
}
