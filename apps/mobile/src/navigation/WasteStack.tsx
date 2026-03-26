import { createStackNavigator } from '@react-navigation/stack';
import { DrawerMenuButton } from '@/components/navigation/DrawerMenuButton';
import WasteListScreen from '@/screens/waste/WasteListScreen';
import type { WasteStackParamList } from '@/types';

const Stack = createStackNavigator<WasteStackParamList>();

export function WasteStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="WasteList"
        component={WasteListScreen}
        options={{ title: 'Waste', headerLeft: () => <DrawerMenuButton /> }}
      />
    </Stack.Navigator>
  );
}
