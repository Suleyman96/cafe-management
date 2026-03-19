import { createStackNavigator } from '@react-navigation/stack';
import ExpensesListScreen from '@/screens/expenses/ExpensesListScreen';
import type { ExpensesStackParamList } from '@/types';

const Stack = createStackNavigator<ExpensesStackParamList>();

export function ExpensesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ExpensesList"
        component={ExpensesListScreen}
        options={{ title: 'Expenses' }}
      />
    </Stack.Navigator>
  );
}
