import 'react-native-gesture-handler';
import './src/lib/i18n';
import type { PlanName } from '@gustri/core';
import { I18nextProvider, i18n } from '@gustri/i18n';
import { DbProvider } from '@gustri/queries';
import { NavigationContainer } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import { MutationCache, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { SnackbarProvider } from './src/components/providers/SnackbarProvider';
import { setupOnlineManager } from './src/hooks/use-network-status';
import { getCurrentUser, onAuthStateChange } from './src/lib/auth';
import { registerForPushNotifications } from './src/lib/notifications';
import {
  asyncStoragePersister,
  OFFLINE_GC_TIME,
  shouldPersistQuery,
} from './src/lib/query-persister';
import { cleanupSounds, setupSounds } from './src/lib/sound';
import { db } from './src/lib/supabase';
import { configureSyncErrorHandling } from './src/lib/sync-handler';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/auth-store';
import { lightTheme } from './src/theme';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  enabled: !__DEV__,
});

// Wire NetInfo to React Query's online manager
setupOnlineManager();

const mutationCache = new MutationCache();
configureSyncErrorHandling(mutationCache);

const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: OFFLINE_GC_TIME,
      retry: 1,
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

function App() {
  const { setStaff, setIsLoading } = useAuthStore();

  useEffect(() => {
    // Initialize auth
    getCurrentUser()
      .then((staff) => {
        setStaff(staff);
        // Bug 4: Fetch tenant plan so pro features are visible
        if (staff) {
          db.tenants
            .getCurrent()
            .then((tenant) => {
              useAuthStore.getState().setTenantPlan(tenant.plan as PlanName);
            })
            .catch((err) => {
              Sentry.captureException(err, { tags: { context: 'mobile-tenant-plan' } });
            });
        }
      })
      .catch((err) => {
        Sentry.captureException(err);
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Listen for auth changes
    const { data } = onAuthStateChange((staff) => {
      setStaff(staff);
      // Also fetch tenant plan on auth state change
      if (staff) {
        db.tenants
          .getCurrent()
          .then((tenant) => {
            useAuthStore.getState().setTenantPlan(tenant.plan as PlanName);
          })
          .catch(() => {});
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [setIsLoading, setStaff]);

  // Store push token when staff is available
  const staff = useAuthStore((s) => s.staff);

  useEffect(() => {
    if (!staff?.id) return;

    registerForPushNotifications().then(async (token) => {
      if (token) {
        try {
          await db.staff.updatePushToken(staff.id, token);
        } catch {
          // Non-critical — local notifications still work
        }
      }
    });
  }, [staff?.id]);

  useEffect(() => {
    setupSounds();

    return () => {
      cleanupSounds();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18n}>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: asyncStoragePersister,
            dehydrateOptions: {
              shouldDehydrateQuery: shouldPersistQuery,
            },
            maxAge: OFFLINE_GC_TIME,
          }}
        >
          <DbProvider db={db}>
            <PaperProvider theme={lightTheme}>
              <SnackbarProvider>
                <NavigationContainer>
                  <ErrorBoundary>
                    <RootNavigator />
                  </ErrorBoundary>
                  <StatusBar style="auto" />
                </NavigationContainer>
              </SnackbarProvider>
            </PaperProvider>
          </DbProvider>
        </PersistQueryClientProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
