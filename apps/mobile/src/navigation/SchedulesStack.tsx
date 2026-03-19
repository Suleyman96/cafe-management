import { createStackNavigator } from '@react-navigation/stack';
import SchedulesScreen from '@/screens/schedules/SchedulesScreen';
import type { SchedulesStackParamList } from '@/types';

const Stack = createStackNavigator<SchedulesStackParamList>();

export function SchedulesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Schedules" component={SchedulesScreen} options={{ title: 'Schedules' }} />
    </Stack.Navigator>
  );
}
