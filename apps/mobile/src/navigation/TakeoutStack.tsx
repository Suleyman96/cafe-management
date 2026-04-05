import { createStackNavigator } from '@react-navigation/stack';
import { DrawerMenuButton } from '@/components/navigation/DrawerMenuButton';
import TakeoutListScreen from '@/screens/takeout/TakeoutListScreen';
import type { TakeoutStackParamList } from '@/types';

const Stack = createStackNavigator<TakeoutStackParamList>();

export function TakeoutStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="TakeoutList"
        component={TakeoutListScreen}
        options={{ title: 'Takeout', headerLeft: () => <DrawerMenuButton /> }}
      />
    </Stack.Navigator>
  );
}
