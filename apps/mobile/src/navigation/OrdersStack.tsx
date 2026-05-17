import { createStackNavigator } from '@react-navigation/stack';
import { IconButton } from 'react-native-paper';
import { DrawerMenuButton } from '@/components/navigation/DrawerMenuButton';
import { headerOptions, ScreenHeader } from '@/components/ui';
import AddItemsScreen from '@/screens/orders/AddItemsScreen';
import OrderDetailScreen from '@/screens/orders/OrderDetailScreen';
import OrderPaymentScreen from '@/screens/orders/OrderPaymentScreen';
import OrdersListScreen from '@/screens/orders/OrdersListScreen';
import type { OrdersStackParamList } from '@/types';

const Stack = createStackNavigator<OrdersStackParamList>();

export function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={{ header: (props) => <ScreenHeader {...props} /> }}>
      <Stack.Screen
        name="OrdersList"
        component={OrdersListScreen}
        options={headerOptions({ titleKey: 'orders', headerLeft: () => <DrawerMenuButton /> })}
      />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={headerOptions({ titleKey: 'orderDetail' })}
      />
      <Stack.Screen
        name="AddItems"
        component={AddItemsScreen}
        options={({ navigation }) =>
          headerOptions({
            titleKey: 'orders.addItems',
            titleNs: 'staff',
            headerRight: () => (
              <IconButton icon="close" size={22} onPress={() => navigation.goBack()} />
            ),
          })
        }
      />
      <Stack.Screen
        name="OrderPayment"
        component={OrderPaymentScreen}
        options={headerOptions({ titleKey: 'orders.payment', titleNs: 'staff' })}
      />
    </Stack.Navigator>
  );
}
