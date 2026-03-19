import { createStackNavigator } from '@react-navigation/stack';
import KitchenDisplayScreen from '@/screens/kitchen/KitchenDisplayScreen';
import type { KitchenStackParamList } from '@/types';

const Stack = createStackNavigator<KitchenStackParamList>();

export function KitchenStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="KitchenDisplay"
        component={KitchenDisplayScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
