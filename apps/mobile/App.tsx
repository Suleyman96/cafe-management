import 'react-native-gesture-handler';
import './src/lib/i18n';
import { getInactivityTimeoutMs } from '@gustri/core';
import { I18nextProvider, i18n } from '@gustri/i18n';
import { DbProvider } from '@gustri/queries';
import { NavigationContainer } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import { focusManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, View } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { SnackbarProvider } from './src/components/providers/SnackbarProvider';
import { useInactivityLock } from './src/hooks/use-inactivity-lock';
import { setupOnlineManager } from './src/hooks/use-network-status';
import { usePushTokenSync } from './src/hooks/use-push-token-sync';
import { forceLogout, getCurrentUser, onAuthStateChange } from './src/lib/auth';
import { checkForOtaUpdate } from './src/lib/check-for-updates';
import {
  clearLastActiveAt,
  initLastActiveAtStore,
  readLastActiveAt,
} from './src/lib/last-active-at';
import { drainMismatchedMutations } from './src/lib/mutation-drain';
import { handleNotificationNavigation, navigationRef } from './src/lib/navigation-ref';
import { drainPendingRevokes } from './src/lib/pending-revokes';
import { queryClient } from './src/lib/query-client';
import {
  asyncStoragePersister,
  CACHE_BUSTER,
  initEncryptedMmkv,
  migrateAsyncStorageToMMKV,
  PERSISTED_MAX_AGE,
  shouldPersistQuery,
  startCacheSizeTelemetry,
} from './src/lib/query-persister';
import { registerMutationDefaults } from './src/lib/register-mutation-defaults';
import { redactJsonBody, redactPii } from './src/lib/sentry-redaction';
import {
  clearSessionStamp,
  initEncryptedSessionStamp,
  readSessionStamp,
} from './src/lib/session-stamp';
import { cleanupSounds, setupSounds } from './src/lib/sound';
import { db } from './src/lib/supabase';
import { linkingConfig } from './src/navigation/linking-config';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/auth-store';
import { usePendingIntentStore } from './src/store/pending-intent-store';
import { lightTheme } from './src/theme';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  enabled: !__DEV__,
  release: `gustri-mobile@${Constants.expoConfig?.version ?? '0.0.0'}+${Updates.runtimeVersion ?? 'unknown'}`,
  dist:
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    undefined,
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
        // M9: Strip PII from request bodies. Fetch breadcrumbs put the body
        // under `data.body`; xhr puts it under `data.data`. Both can carry
        // customer name/phone/address from order-create or feedback flows.
        if (breadcrumb.data) {
          const data = breadcrumb.data as Record<string, unknown>;
          if ('body' in data) data.body = redactJsonBody(data.body);
          if ('data' in data) data.data = redactJsonBody(data.data);
        }
      }
    }
    if (event.request && event.request.data !== undefined) {
      event.request.data = redactPii(event.request.data) as typeof event.request.data;
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
  const setIsLoading = useAuthStore((s) => s.setIsLoading);
  const loadSession = useAuthStore((s) => s.loadSession);
  // Gate the persister mount on AsyncStorage→MMKV migration. The migration is
  // async (one AsyncStorage read), but MMKV is sync — once migrated, the
  // persister hydrates synchronously. Without the gate, a freshly upgraded
  // user would lose the previous session's cache on first launch even though
  // the migration eventually copies the data over.
  const [migrationDone, setMigrationDone] = useState(false);
  useInactivityLock();
  usePushTokenSync();

  useEffect(() => {
    let active = true;
    (async () => {
      // Encryption-key + encrypted MMKV instances must be ready before any
      // code reads/writes a persisted blob. Both inits are idempotent and
      // share the keystore-resident key, so the second `getOrCreate` call
      // hits the in-memory cache.
      try {
        await initEncryptedMmkv();
        await initEncryptedSessionStamp();
        await initLastActiveAtStore();
      } catch (err) {
        Sentry.captureException(err, { tags: { area: 'mmkv-encryption-init' } });
        // Boot is unrecoverable without an encrypted persister; surface the
        // loader indefinitely rather than mounting the app with a broken
        // cache. The next cold launch retries.
        return;
      }

      await migrateAsyncStorageToMMKV();

      // Tenant-mismatch check BEFORE the persister hydrates. If the previous
      // session on this device belonged to a different tenant/staff than the
      // one currently authenticated (auth flip while offline, app crash
      // mid-cleanup, etc.), drop the persisted blob entirely so no screen
      // can render the prior tenant's data — even for one frame.
      try {
        const stamp = readSessionStamp();
        if (stamp) {
          const current = await getCurrentUser();
          const matches = current?.tenant_id === stamp.tenantId && current?.id === stamp.staffId;
          if (!matches) {
            try {
              await asyncStoragePersister.removeClient();
            } catch {
              // Persister cleanup is best-effort.
            }
            clearSessionStamp();
            Sentry.addBreadcrumb({
              category: 'auth',
              message: 'pre-hydration tenant mismatch — dropped persisted cache',
              data: { hadStamp: true, hasCurrent: current !== null },
            });
          }
        }
      } catch (err) {
        Sentry.captureException(err, { tags: { area: 'pre-hydration-tenant-check' } });
      }

      if (active) setMigrationDone(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Per-minute cache size sampler. Sentry breadcrumb shows realistic per-user
  // cache growth alongside any captured error, and a single warning event
  // fires past 8MB so we hear about runaways before users do.
  useEffect(() => {
    const stop = startCacheSizeTelemetry();
    return stop;
  }, []);

  // One-shot drain of any push-token revokes queued during a previous
  // offline logout. Runs once after MMKV is encrypted-init'd; the queue
  // is read regardless of who (if anyone) is logged in, since the prior
  // tenant's tokens still need to come off the server. Network/5xx
  // failures keep the entry queued for the next launch.
  useEffect(() => {
    if (!migrationDone) return;
    drainPendingRevokes().catch((err) => {
      Sentry.captureException(err, { tags: { area: 'boot-drain-pending-revokes' } });
    });
  }, [migrationDone]);

  // Boot-time OTA check — fetches a published update if available and reloads
  // into it before the user starts interacting. No-op in dev. Failures are
  // captured to Sentry via checkForOtaUpdate and never block app start.
  useEffect(() => {
    checkForOtaUpdate().then((hasUpdate) => {
      if (hasUpdate) Updates.reloadAsync();
    });
  }, []);

  useEffect(() => {
    // Initialize auth — also enforce the inactivity lock at cold start.
    // Without this check, force-quit + relaunch (or relaunch after the
    // device sat locked overnight) would silently restore a stale session.
    getCurrentUser()
      .then(async (staff) => {
        if (staff) {
          const last = readLastActiveAt();
          if (last !== null) {
            const elapsed = Date.now() - last;
            const timeoutMs = getInactivityTimeoutMs(staff.role);
            // Always clear the stamp post-read so we don't re-trigger if the
            // user retries a failed network call before backgrounding again.
            clearLastActiveAt();
            if (elapsed >= timeoutMs) {
              Sentry.addBreadcrumb({
                category: 'auth',
                message: 'cold-start inactivity timeout — forcing logout',
                data: { role: staff.role, elapsedMs: elapsed, timeoutMs },
              });
              await forceLogout('inactivity');
              setIsLoading(false);
              return;
            }
          }
        }
        await loadSession(staff);
      })
      .catch((err) => {
        Sentry.captureException(err);
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Listen for auth changes — single fetch path through loadSession.
    const { data } = onAuthStateChange((staff) => {
      void loadSession(staff);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [setIsLoading, loadSession]);

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

  // Handle deep-link / universal-link entries that arrive while the user is
  // logged out or before the navigator is ready. NavigationContainer's
  // `linking` config dispatches URLs when a target screen is mounted, so we
  // only need to stash for the logged-out / not-ready case — the post-login
  // replay effect in RootNavigator re-emits via Linking.openURL once the
  // Main stack mounts. Without this, a tap on a magic auth link, password
  // reset, or web→app handoff would land in the Auth stack and silently die.
  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => {
        if (!url) return;
        if (!useAuthStore.getState().staff) {
          usePendingIntentStore.getState().addPending({ type: 'deep-link', url });
        }
      })
      .catch(() => {
        // No initial URL — normal launch
      });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (!useAuthStore.getState().staff || !navigationRef.isReady()) {
        usePendingIntentStore.getState().addPending({ type: 'deep-link', url });
      }
      // When logged in and ready, NavigationContainer's linking config
      // handles the URL automatically — no manual openURL needed.
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!migrationDone) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

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
              // The meta gate enforces that any persisted mutation carries
              // tenant/staff identity so cross-tenant replay can be detected
              // on next launch (see C2 / mutation-drain).
              shouldDehydrateMutation: (m) => {
                if (!(m.state.isPaused === true && m.options.mutationKey !== undefined)) {
                  return false;
                }
                const meta = (m.meta ?? {}) as Record<string, unknown>;
                return typeof meta.tenantId === 'string' && typeof meta.staffId === 'string';
              },
            },
            maxAge: PERSISTED_MAX_AGE,
          }}
          onSuccess={() => {
            // Hydration complete — drop any paused mutations whose stamp
            // doesn't match the current session before resuming, then replay
            // the rest. Without the drain, user A's queued offline mutations
            // would replay under user B's auth context (cross-tenant write)
            // when B logs in on the same device.
            (async () => {
              try {
                const current = await getCurrentUser();
                const session = current
                  ? { tenantId: current.tenant_id, staffId: current.id }
                  : null;
                const discarded = drainMismatchedMutations(queryClient, session);
                if (discarded > 0) {
                  Sentry.addBreadcrumb({
                    category: 'auth',
                    message: `discarded ${discarded} mismatched mutation(s) on hydration`,
                    data: { discarded, hasCurrent: current !== null },
                  });
                }
                await queryClient.resumePausedMutations();
              } catch (err) {
                Sentry.captureException(err, { tags: { area: 'resume-paused-mutations' } });
              }
            })();
          }}
        >
          <DbProvider db={db}>
            <PaperProvider theme={lightTheme}>
              <SnackbarProvider>
                <NavigationContainer ref={navigationRef} linking={linkingConfig}>
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
