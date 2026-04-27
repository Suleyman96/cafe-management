import { createStackNavigator } from '@react-navigation/stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PendingSyncBadge } from '@/components/PendingSyncBadge';
import { RealtimeStatusBanner } from '@/components/RealtimeStatusBanner';
import { handleNotificationNavigation } from '@/lib/navigation-ref';
import { Text } from '@/lib/paper-compat';
import { checkVersion, type GateResult } from '@/lib/version-gate';
import { ForceUpdateScreen } from '@/screens/system/ForceUpdateScreen';
import { MaintenanceScreen } from '@/screens/system/MaintenanceScreen';
import { useAuthStore } from '@/store/auth-store';
import { usePendingIntentStore } from '@/store/pending-intent-store';
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

function SplashView() {
  return (
    <View style={splashStyles.container}>
      <Text style={splashStyles.brand}>gustri</Text>
      <ActivityIndicator size="large" color={BRAND_PRIMARY} />
    </View>
  );
}

export function RootNavigator() {
  const { staff, isLoading } = useAuthStore();
  const [gate, setGate] = useState<GateResult | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    checkVersion().then(setGate);
  }, []);

  const retryGate = () => {
    setRetrying(true);
    checkVersion()
      .then(setGate)
      .finally(() => setRetrying(false));
  };

  // Replay any pending notification/deep-link intent that arrived while the
  // user was logged out. Defer one frame so the Main stack finishes mounting
  // before we navigate, otherwise the dispatch hits the still-mounted Auth
  // stack and is dropped.
  useEffect(() => {
    if (!staff) return;
    const intent = usePendingIntentStore.getState().consumePending();
    if (!intent) return;
    requestAnimationFrame(() => {
      if (intent.type === 'notification') {
        handleNotificationNavigation(intent.data as Record<string, unknown> | null | undefined);
      } else if (intent.type === 'deep-link') {
        Linking.openURL(intent.url);
      }
    });
  }, [staff]);

  if (!gate) return <SplashView />;
  if (gate.status === 'force-update') return <ForceUpdateScreen latest={gate.latest} />;
  if (gate.status === 'maintenance')
    return <MaintenanceScreen message={gate.message} onRetry={retryGate} retrying={retrying} />;

  if (isLoading) {
    return <SplashView />;
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
