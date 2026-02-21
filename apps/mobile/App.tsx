import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getCurrentUser, onAuthStateChange } from './src/lib/auth';
import { registerForPushNotifications } from './src/lib/notifications';
import { setupSounds } from './src/lib/sound';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/auth-store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
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
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <NavigationContainer>
            <RootNavigator />
            <StatusBar style="auto" />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
