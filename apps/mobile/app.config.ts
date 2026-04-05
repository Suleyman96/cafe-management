import type { ExpoConfig, ConfigContext } from 'expo/config';

// Default values for local development
const LOCAL_SUPABASE_URL = 'http://192.168.40.106:54321';
const LOCAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name || 'Gustri',
  slug: config.slug || 'gustri',
  extra: {
    ...config.extra,
    EXPO_PUBLIC_SUPABASE_URL:
      process.env.EXPO_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || LOCAL_SUPABASE_ANON_KEY,
  },
});
