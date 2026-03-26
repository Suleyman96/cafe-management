import { createStackNavigator } from '@react-navigation/stack';
import { DrawerMenuButton } from '@/components/navigation/DrawerMenuButton';
import StockListScreen from '@/screens/stock/StockListScreen';
import type { StockStackParamList } from '@/types';

const Stack = createStackNavigator<StockStackParamList>();

export function StockStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="StockList"
        component={StockListScreen}
        options={{ title: 'Stock', headerLeft: () => <DrawerMenuButton /> }}
      />
    </Stack.Navigator>
  );
}
