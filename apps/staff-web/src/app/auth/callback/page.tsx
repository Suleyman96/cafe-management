'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setStaff } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get tokens from URL hash (magic link redirect)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const errorParam = hashParams.get('error');

        if (errorParam) {
          throw new Error(decodeURIComponent(errorParam));
        }

        if (!accessToken) {
          // Check if we already have a session
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            // Already logged in, redirect to home
            router.push('/');
            return;
          }
          throw new Error('No authentication token found in URL');
        }

        // Set the session
        const { data: sessionData, error: setError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (setError || !sessionData.session) {
          throw setError || new Error('Failed to set session');
        }

        // Fetch staff record
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select('*')
          .eq('auth_user_id', sessionData.session.user.id)
          .eq('is_active', true)
          .single();

        if (staffError || !staffData) {
          await supabase.auth.signOut();
          throw new Error('Staff account not found or inactive');
        }

        setStaff(staffData);
        
        // Clear the hash to prevent redirect loops
        window.history.replaceState(null, '', '/');
        
        // Redirect to home
        router.push('/');
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || 'Authentication failed');
        setIsLoading(false);
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push(`/login?error=${encodeURIComponent(err.message || 'Authentication failed')}`);
        }, 3000);
      }
    };

    handleAuthCallback();
  }, [router, setStaff]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Failed</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Completing sign in...</h2>
        <p className="text-gray-600">Please wait while we verify your account.</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Loading...</h2>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}