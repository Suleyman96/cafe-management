import { createStackNavigator } from '@react-navigation/stack';
import { DrawerMenuButton } from '@/components/navigation/DrawerMenuButton';
import WaiterCallsScreen from '@/screens/calls/WaiterCallsScreen';
import type { CallsStackParamList } from '@/types';

const Stack = createStackNavigator<CallsStackParamList>();

export function CallsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="WaiterCallsList"
        component={WaiterCallsScreen}
        options={{ title: 'Waiter Calls', headerLeft: () => <DrawerMenuButton /> }}
      />
    </Stack.Navigator>
  );
}
