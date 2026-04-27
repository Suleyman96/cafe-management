import 'react-native-gesture-handler';
import './src/lib/i18n';
import type { PlanName } from '@gustri/core';
import { I18nextProvider, i18n } from '@gustri/i18n';
import { DbProvider } from '@gustri/queries';
import { NavigationContainer } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import { focusManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { SnackbarProvider } from './src/components/providers/SnackbarProvider';
import { useInactivityLock } from './src/hooks/use-inactivity-lock';
import { setupOnlineManager } from './src/hooks/use-network-status';
import { usePushTokenSync } from './src/hooks/use-push-token-sync';
import { getCurrentUser, onAuthStateChange } from './src/lib/auth';
import { handleNotificationNavigation, navigationRef } from './src/lib/navigation-ref';
import { queryClient } from './src/lib/query-client';
import {
  asyncStoragePersister,
  CACHE_BUSTER,
  PERSISTED_MAX_AGE,
  shouldPersistQuery,
} from './src/lib/query-persister';
import { registerMutationDefaults } from './src/lib/register-mutation-defaults';
import { cleanupSounds, setupSounds } from './src/lib/sound';
import { db } from './src/lib/supabase';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/auth-store';
import { lightTheme } from './src/theme';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  enabled: !__DEV__,
  beforeSend(event) {
    if (event.breadcrumbs) {
      for (const breadcrumb of event.breadcrumbs) {
        if (breadcrumb.data?.headers) {
          delete breadcrumb.data.headers.Authorization;
          delete breadcrumb.data.headers.authorization;
        }
        if (breadcrumb.data?.url) {
          try {
            const url = new URL(breadcrumb.data.url);
            url.searchParams.delete('token');
            url.searchParams.delete('apikey');
            breadcrumb.data.url = url.toString();
          } catch {
            // Not a valid URL, leave as-is
          }
        }
      }
    }
    return event;
  },
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'fetch' && breadcrumb.data?.url?.includes('/auth/')) {
      return null;
    }
    return breadcrumb;
  },
});

// Register mutationFn defaults BEFORE the persister hydrates so any paused
// mutations restored from disk have a function to resume with. Without this,
// rehydrated mutations are orphans that error the moment they try to run.
registerMutationDefaults(queryClient);

// Wire NetInfo to React Query's online manager
setupOnlineManager();

// Wire AppState to React Query's focus manager so stale queries refetch when
// the app returns to the foreground. Without this, a backgrounded app shows
// stale data on resume until the next user-triggered render or the 2-min
// realtime fallback poll fires — too slow for an in-service waiter.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (state) => {
    handleFocus(state === 'active');
  });
  return () => sub.remove();
});

// Dev-only: surface unhandled promise rejections in the console so silent
// fire-and-forget regressions are caught during development. No-op in prod.
if (__DEV__) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (id: number, err: unknown) => {
        console.error(`[unhandled-rejection #${id}]`, err);
      },
      onHandled: () => {},
    });
  } catch {
    // Module not available — silently skip.
  }
}

function App() {
  const { setStaff, setIsLoading } = useAuthStore();
  useInactivityLock();
  usePushTokenSync();

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

  useEffect(() => {
    setupSounds();

    return () => {
      cleanupSounds();
    };
  }, []);

  // Handle notification taps — route to relevant screen
  useEffect(() => {
    // Cold-start: app was opened from a notification tap
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          handleNotificationNavigation(
            response.notification.request.content.data as Record<string, unknown>,
          );
        }
      })
      .catch(() => {
        // No prior notification response — normal app launch
      });

    // Warm: user taps a notification while app is running
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationNavigation(
        response.notification.request.content.data as Record<string, unknown>,
      );
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18n}>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: asyncStoragePersister,
            buster: CACHE_BUSTER,
            dehydrateOptions: {
              shouldDehydrateQuery: shouldPersistQuery,
              // Persist only paused mutations whose key has a registered
              // default in register-mutation-defaults.ts. The key gate is a
              // belt-and-braces check: re-exported queries-package mutations
              // (no mobile mutationKey) won't accidentally hydrate as orphans.
              shouldDehydrateMutation: (m) =>
                m.state.isPaused === true && m.options.mutationKey !== undefined,
            },
            maxAge: PERSISTED_MAX_AGE,
          }}
          onSuccess={() => {
            // Hydration complete — resume any paused mutations carried over
            // from the previous session so queued offline writes replay now
            // that the queryClient is ready.
            queryClient.resumePausedMutations().catch((err) => {
              Sentry.captureException(err, { tags: { area: 'resume-paused-mutations' } });
            });
          }}
        >
          <DbProvider db={db}>
            <PaperProvider theme={lightTheme}>
              <SnackbarProvider>
                <NavigationContainer ref={navigationRef}>
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
