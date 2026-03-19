import { createStackNavigator } from '@react-navigation/stack';
import CafeSettingsScreen from '@/screens/settings/CafeSettingsScreen';
import type { CafeSettingsStackParamList } from '@/types';

const Stack = createStackNavigator<CafeSettingsStackParamList>();

export function CafeSettingsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="CafeSettings"
        component={CafeSettingsScreen}
        options={{ title: 'Cafe Settings' }}
      />
    </Stack.Navigator>
  );
}
