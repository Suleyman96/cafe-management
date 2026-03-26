import { createStackNavigator } from '@react-navigation/stack';
import { DrawerMenuButton } from '@/components/navigation/DrawerMenuButton';
import ReportsScreen from '@/screens/reports/ReportsScreen';
import type { ReportsStackParamList } from '@/types';

const Stack = createStackNavigator<ReportsStackParamList>();

export function ReportsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: 'Reports', headerLeft: () => <DrawerMenuButton /> }}
      />
    </Stack.Navigator>
  );
}
