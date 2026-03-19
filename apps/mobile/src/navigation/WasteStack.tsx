import { createStackNavigator } from '@react-navigation/stack';
import WasteListScreen from '@/screens/waste/WasteListScreen';
import type { WasteStackParamList } from '@/types';

const Stack = createStackNavigator<WasteStackParamList>();

export function WasteStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="WasteList" component={WasteListScreen} options={{ title: 'Waste' }} />
    </Stack.Navigator>
  );
}
