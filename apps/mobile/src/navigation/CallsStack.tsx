import { createStackNavigator } from '@react-navigation/stack';
import WaiterCallsScreen from '@/screens/calls/WaiterCallsScreen';
import type { CallsStackParamList } from '@/types';

const Stack = createStackNavigator<CallsStackParamList>();

export function CallsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="WaiterCallsList"
        component={WaiterCallsScreen}
        options={{ title: 'Waiter Calls' }}
      />
    </Stack.Navigator>
  );
}
