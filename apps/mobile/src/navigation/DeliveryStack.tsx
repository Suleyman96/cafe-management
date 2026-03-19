import { createStackNavigator } from '@react-navigation/stack';
import DeliveryListScreen from '@/screens/delivery/DeliveryListScreen';
import type { DeliveryStackParamList } from '@/types';

const Stack = createStackNavigator<DeliveryStackParamList>();

export function DeliveryStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="DeliveryList"
        component={DeliveryListScreen}
        options={{ title: 'Delivery' }}
      />
    </Stack.Navigator>
  );
}
