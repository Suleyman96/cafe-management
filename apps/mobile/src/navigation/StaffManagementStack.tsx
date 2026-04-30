import { createStackNavigator } from '@react-navigation/stack';
import { DrawerMenuButton } from '@/components/navigation/DrawerMenuButton';
import type { StaffManagementStackParamList } from '@/types';
import { lazyScreen } from './lazy-screen';

const Stack = createStackNavigator<StaffManagementStackParamList>();

const StaffListScreen = lazyScreen(() => import('@/screens/staff-management/StaffListScreen'));
const StaffDetailScreen = lazyScreen(() => import('@/screens/staff-management/StaffDetailScreen'));

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
