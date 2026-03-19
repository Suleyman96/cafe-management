import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '@/store/auth-store';
import type { RootStackParamList } from '@/types';
import { AuthStack } from './AuthStack';
import { DrawerNavigator } from './DrawerNavigator';

const Stack = createStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { staff, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {staff ? (
        <Stack.Screen name="Main" component={DrawerNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
}
