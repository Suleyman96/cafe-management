import { createStackNavigator } from '@react-navigation/stack';
import { DrawerMenuButton } from '@/components/navigation/DrawerMenuButton';
import TasksListScreen from '@/screens/tasks/TasksListScreen';
import type { TasksStackParamList } from '@/types';

const Stack = createStackNavigator<TasksStackParamList>();

export function TasksStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="TasksList"
        component={TasksListScreen}
        options={{ title: 'Tasks', headerLeft: () => <DrawerMenuButton /> }}
      />
    </Stack.Navigator>
  );
}
