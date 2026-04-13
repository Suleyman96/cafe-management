import { createStackNavigator } from '@react-navigation/stack';
import { IconButton } from 'react-native-paper';
import { DrawerMenuButton } from '@/components/navigation/DrawerMenuButton';
import AddItemsScreen from '@/screens/orders/AddItemsScreen';
import OrderDetailScreen from '@/screens/orders/OrderDetailScreen';
import OrderPaymentScreen from '@/screens/orders/OrderPaymentScreen';
import OrdersListScreen from '@/screens/orders/OrdersListScreen';
import type { OrdersStackParamList } from '@/types';

const Stack = createStackNavigator<OrdersStackParamList>();

export function OrdersStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="OrdersList"
        component={OrdersListScreen}
        options={{ title: 'Orders', headerLeft: () => <DrawerMenuButton /> }}
      />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Order' }} />
      <Stack.Screen
        name="AddItems"
        component={AddItemsScreen}
        options={({ navigation }) => ({
          title: 'Add Items',
          headerRight: () => (
            <IconButton icon="close" size={22} onPress={() => navigation.goBack()} />
          ),
        })}
      />
      <Stack.Screen
        name="OrderPayment"
        component={OrderPaymentScreen}
        options={{ title: 'Payment' }}
      />
    </Stack.Navigator>
  );
}
