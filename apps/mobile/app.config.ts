import type { ConfigContext, ExpoConfig } from 'expo/config';

// Local development fallback only — see .env.example for required env vars.
// Production/preview builds enforce env vars via the guard below.
// L10 — use loopback hosts, not a hardcoded LAN IP. (To run the app on a
// physical device against a local dev server, set EXPO_PUBLIC_SUPABASE_URL /
// EXPO_PUBLIC_API_BASE_URL to your machine's LAN address via env.)
const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
const LOCAL_API_BASE_URL = 'http://127.0.0.1:3001';
// Supabase's well-known local demo anon key — only used for local dev boots.
const LOCAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const REQUIRED_SECRETS = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = process.env.EAS_BUILD_PROFILE;
  // Dev when this is not a production/preview EAS build. The anon-key fallback
  // is dev-only; production/preview require real env (enforced just below).
  const isDevBuild = profile !== 'production' && profile !== 'preview';

  if (profile === 'production' || profile === 'preview') {
    for (const key of REQUIRED_SECRETS) {
      if (!process.env[key]) {
        throw new Error(
          `[eas-build] Missing required env var ${key} for profile ${profile}. ` +
            `Set it via \`eas env:create --environment ${profile} --name ${key} --value <value>\`.`,
        );
      }
    }
    if (profile === 'production' && !process.env.EXPO_PUBLIC_SENTRY_DSN) {
      throw new Error(
        '[eas-build] Missing EXPO_PUBLIC_SENTRY_DSN for production build. ' +
          'Set it via `eas env:create --environment production --name EXPO_PUBLIC_SENTRY_DSN --value <dsn>`.',
      );
    }
  }

  return {
    ...config,
    name: config.name || 'gustri',
    slug: config.slug || 'gustri',
    scheme: 'gustri',
    extra: {
      ...config.extra,
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL,
      // Dev-only anon-key fallback. Production/preview never reach the fallback
      // (the guard above throws when the env var is missing).
      EXPO_PUBLIC_SUPABASE_ANON_KEY:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || (isDevBuild ? LOCAL_SUPABASE_ANON_KEY : ''),
      EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || LOCAL_API_BASE_URL,
      EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
    },
  };
};
