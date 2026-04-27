import { AppVersionResponseSchema } from '@gustri/database';
import * as Sentry from '@sentry/react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import semver from 'semver';
import { supabase } from './supabase';

/**
 * Server-driven gate evaluated once at app launch. Lets the backend lock out
 * mobile binaries that are incompatible with a deployed migration, or put all
 * clients into a maintenance hold.
 *
 * Failure mode is *fail-open*: if Supabase is unreachable, the response shape
 * is unexpected, or anything else goes wrong, we let the user into the app.
 * This avoids turning a transient backend hiccup into a fleet-wide outage.
 */
export type GateResult =
  | { status: 'ok' }
  | { status: 'force-update'; latest: string }
  | { status: 'maintenance'; message: string | null };

export async function checkVersion(): Promise<GateResult> {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const current = Constants.expoConfig?.version ?? '0.0.0';

  try {
    // Cast to an untyped client: matches the wrapper-package convention
    // (`AnySupabaseClient = SupabaseClient<any>`) used everywhere RPCs are
    // called. Strict rpc generics in supabase-js stumble on this signature
    // and the runtime parse below is the real source of truth anyway.
    // biome-ignore lint/suspicious/noExplicitAny: matches AnySupabaseClient pattern in @gustri/api-client
    const anyClient = supabase as unknown as SupabaseClient<any>;
    const { data, error } = await anyClient.rpc('get_app_version', { p_platform: platform });
    if (error || !data?.[0]) return { status: 'ok' };

    const parsed = AppVersionResponseSchema.safeParse(data[0]);
    if (!parsed.success) return { status: 'ok' };

    if (parsed.data.maintenance_mode) {
      return { status: 'maintenance', message: parsed.data.maintenance_message };
    }
    if (semver.lt(current, parsed.data.min_supported_version)) {
      return { status: 'force-update', latest: parsed.data.latest_version };
    }
    return { status: 'ok' };
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'version-gate' } });
    return { status: 'ok' };
  }
}
