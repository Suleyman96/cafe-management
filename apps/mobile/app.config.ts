import type { ConfigContext, ExpoConfig } from 'expo/config';

// Local development fallback only — see .env.example for required env vars.
// Production builds enforce env vars via the isProduction guard below.
const LOCAL_SUPABASE_URL = 'http://192.168.40.106:54321';
const LOCAL_API_BASE_URL = 'http://192.168.40.106:3001';
const LOCAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export default ({ config }: ConfigContext): ExpoConfig => {
  const isProduction = process.env.EAS_BUILD_PROFILE === 'production';

  if (isProduction && !process.env.EXPO_PUBLIC_SUPABASE_URL) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL must be set for production builds. Use EAS Secrets.');
  }

  return {
    ...config,
    name: config.name || 'gustri',
    slug: config.slug || 'gustri',
    scheme: 'gustri',
    extra: {
      ...config.extra,
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || LOCAL_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || LOCAL_API_BASE_URL,
      EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
    },
  };
};
