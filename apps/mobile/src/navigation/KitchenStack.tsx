import { createStackNavigator } from '@react-navigation/stack';
import { DrawerMenuButton } from '@/components/navigation/DrawerMenuButton';
import KitchenDisplayScreen from '@/screens/kitchen/KitchenDisplayScreen';
import type { KitchenStackParamList } from '@/types';

const Stack = createStackNavigator<KitchenStackParamList>();

export function KitchenStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="KitchenDisplay"
        component={KitchenDisplayScreen}
        options={{ title: 'Kitchen', headerLeft: () => <DrawerMenuButton /> }}
      />
    </Stack.Navigator>
  );
}
