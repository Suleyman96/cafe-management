import { createStackNavigator } from '@react-navigation/stack';
import TableDetailScreen from '@/screens/tables/TableDetailScreen';
import TablesListScreen from '@/screens/tables/TablesListScreen';
import type { TablesStackParamList } from '@/types';

const Stack = createStackNavigator<TablesStackParamList>();

export function TablesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="TablesList" component={TablesListScreen} options={{ title: 'Tables' }} />
      <Stack.Screen
        name="TableDetail"
        component={TableDetailScreen}
        options={{ title: 'Table Detail' }}
      />
    </Stack.Navigator>
  );
}
