'use client';

import { Button } from '@gustri/ui-web';
import * as Sentry from '@sentry/nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { installSession } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';

/**
 * SIMPLE Dev Login: Direct session creation, no redirects
 */
export function DevLoginButton() {
  const router = useRouter();
  const { setStaff } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDevLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get session tokens directly from API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('/api/auth/dev-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@test.com' }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      // If we have tokens, use them directly (no redirects!)
      if (data.access_token) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token || '',
        });

        if (sessionError || !sessionData.session) {
          throw new Error(`Failed to set session: ${sessionError?.message || 'Unknown error'}`);
        }

        // Fetch staff record
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select('*')
          .eq('auth_user_id', data.user.id)
          .eq('is_active', true)
          .single();

        if (staffError || !staffData) {
          await supabase.auth.signOut();
          throw new Error(
            'Staff account not found. Run the SQL script to link user to staff table.',
          );
        }

        installSession(staffData, setStaff);
        router.push('/');
        return;
      }

      // If no tokens, show error
      throw new Error(data.error || 'No access token received');
    } catch (err: unknown) {
      Sentry.captureException(err);
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Is Supabase running?');
      } else {
        const message = err instanceof Error ? err.message : 'Login failed';
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <p className="text-sm text-yellow-800 mb-2">
        <strong>Dev Mode:</strong> Direct login (no redirects)
      </p>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <Button
        onClick={handleDevLogin}
        disabled={isLoading}
        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
      >
        {isLoading ? 'Logging in...' : '🚀 Dev Login (admin@test.com)'}
      </Button>
      <p className="text-xs text-yellow-700 mt-2">
        Make sure you've run the SQL script to create the user first!
      </p>
    </div>
  );
}
