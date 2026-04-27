import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PendingSyncBadge } from '@/components/PendingSyncBadge';
import { RealtimeStatusBanner } from '@/components/RealtimeStatusBanner';
import { Text } from '@/lib/paper-compat';
import { useAuthStore } from '@/store/auth-store';
import { BRAND_PRIMARY, COLORS } from '@/theme';
import type { RootStackParamList } from '@/types';
import { AuthStack } from './AuthStack';
import { DrawerNavigator } from './DrawerNavigator';

const Stack = createStackNavigator<RootStackParamList>();

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  brand: {
    fontSize: 32,
    fontWeight: '700',
    color: BRAND_PRIMARY,
    marginBottom: 24,
  },
});

export function RootNavigator() {
  const { staff, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={splashStyles.container}>
        <Text style={splashStyles.brand}>gustri</Text>
        <ActivityIndicator size="large" color={BRAND_PRIMARY} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <RealtimeStatusBanner />
      <PendingSyncBadge />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {staff ? (
          <Stack.Screen name="Main" component={DrawerNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    </View>
  );
}
