import 'react-native-url-polyfill/auto';
import { createSupabaseWrapper } from '@gustri/api-client';
import type { Database } from '@gustri/database/types';
import * as Sentry from '@sentry/react-native';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const secureStorageAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Wrapped client for type-safe operations.
// `tenantId` is null until auth.ts calls `db.setTenantContext(tenantId)` after
// staff lookup; the wrapper applies a defense-in-depth `eq('tenant_id')`
// predicate to every read once it's bound.
export const db = createSupabaseWrapper(supabase, {
  sentry: {
    captureMessage: (message, options) => {
      Sentry.captureMessage(message, options);
    },
  },
});
