import type { Database } from '@gustri/database/types';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const FETCH_TIMEOUT_MS = 15_000;

export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      // Compose with any existing signal (e.g. from React Query)
      if (options?.signal) {
        options.signal.addEventListener('abort', () => controller.abort());
      }

      return fetch(url, { ...options, signal: controller.signal }).finally(() => {
        clearTimeout(timeoutId);
      });
    },
  },
});
