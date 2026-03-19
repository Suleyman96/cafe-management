import { createStackNavigator } from '@react-navigation/stack';
import StockListScreen from '@/screens/stock/StockListScreen';
import type { StockStackParamList } from '@/types';

const Stack = createStackNavigator<StockStackParamList>();

export function StockStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="StockList" component={StockListScreen} options={{ title: 'Stock' }} />
    </Stack.Navigator>
  );
}
