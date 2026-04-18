import 'react-native-gesture-handler';
import './src/lib/i18n';
import { I18nextProvider, i18n } from '@gustri/i18n';
import { NavigationContainer } from '@react-navigation/native';
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
import { setupSounds } from './src/lib/sound';
import { configureSyncErrorHandling } from './src/lib/sync-handler';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/auth-store';
import { lightTheme } from './src/theme';

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

export default function App() {
  const { setStaff, setIsLoading } = useAuthStore();

  useEffect(() => {
    // Initialize auth
    getCurrentUser().then((staff) => {
      setStaff(staff);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data } = onAuthStateChange((staff) => {
      setStaff(staff);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [setIsLoading, setStaff]);

  useEffect(() => {
    // Setup push notifications
    registerForPushNotifications();

    // Setup sounds
    setupSounds();
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
        </PersistQueryClientProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}
