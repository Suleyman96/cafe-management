import { createStackNavigator } from '@react-navigation/stack';
import { DrawerMenuButton } from '@/components/navigation/DrawerMenuButton';
import ExpensesListScreen from '@/screens/expenses/ExpensesListScreen';
import type { ExpensesStackParamList } from '@/types';

const Stack = createStackNavigator<ExpensesStackParamList>();

export function ExpensesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ExpensesList"
        component={ExpensesListScreen}
        options={{ title: 'Expenses', headerLeft: () => <DrawerMenuButton /> }}
      />
    </Stack.Navigator>
  );
}
