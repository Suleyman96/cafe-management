/**
 * Wrapped Supabase Client
 * Uses the comprehensive wrapper for type-safe operations.
 * Re-uses the single shared Supabase client to avoid dual GoTrueClient issues.
 */

import { createSupabaseWrapper } from '@gustri/api-client';
import * as Sentry from '@sentry/nextjs';
import { supabase } from './client';

// Create the wrapped client with all type-safe methods, using the shared client.
// `tenantId` is null until the auth hook calls `db.setTenantContext(tenantId)`
// after staff lookup; the wrapper applies a defense-in-depth `eq('tenant_id')`
// predicate to every read once it's bound.
export const db = createSupabaseWrapper(supabase, {
  sentry: {
    captureMessage: (message, options) => {
      Sentry.captureMessage(message, options);
    },
  },
});

// Re-export the shared client for convenience
export { supabase };
