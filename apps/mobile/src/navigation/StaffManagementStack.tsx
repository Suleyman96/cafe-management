import { createStackNavigator } from '@react-navigation/stack';
import type React from 'react';
import { DrawerMenuButton } from '@/components/navigation/DrawerMenuButton';
import type { StaffManagementStackParamList } from '@/types';
import { lazyScreen } from './lazy-screen';

const Stack = createStackNavigator<StaffManagementStackParamList>();

const StaffListScreen = lazyScreen(() => import('@/screens/staff-management/StaffListScreen'));
const StaffDetailScreen = lazyScreen(() => import('@/screens/staff-management/StaffDetailScreen'));

// React 18/19 @types/react clash between React Navigation and the mobile
// app's React 19 install (matches the cast in create-simple-stack.tsx).
// The real contract is `React.ComponentType` for the screen — the cast
// just bridges the bigint/async ReactNode delta.
const asScreen = <P extends object>(c: React.ComponentType<P>) =>
  c as React.ComponentType<unknown> as never;

export function StaffManagementStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="StaffList"
        component={asScreen(StaffListScreen)}
        options={{ title: 'Staff', headerLeft: () => <DrawerMenuButton /> }}
      />
      <Stack.Screen
        name="StaffDetail"
        component={asScreen(StaffDetailScreen)}
        options={{ title: 'Staff Detail' }}
      />
    </Stack.Navigator>
  );
}
