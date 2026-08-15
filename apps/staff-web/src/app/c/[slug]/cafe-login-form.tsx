'use client';

import { useTranslation } from '@gustri/i18n';
import { GustriLogo } from '@gustri/ui-web';
import * as Sentry from '@sentry/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { installSession } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { signInWithCafeAction } from './actions';

export function CafeLoginForm({ slug, cafeName }: { slug: string; cafeName: string }) {
  const router = useRouter();
  const { t } = useTranslation('auth');
  const { staff, setStaff } = useAuthStore();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (staff) router.push('/');
  }, [staff, router]);

  const isValid = identifier.trim().length > 0 && password.length > 0;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading) return;
    setError('');
    setLoading(true);
    try {
      const result = await signInWithCafeAction(slug, identifier.trim(), password);
      if (result.ok) {
        // Same hand-off as the global login: prime the browser SDK singleton
        // (which mounted with no session) so useAuth doesn't bounce us back.
        const { error: sessionError } = await supabase.auth.setSession(result.session);
        if (sessionError) {
          Sentry.captureException(sessionError, { tags: { context: 'cafe-login-set-session' } });
          setError(t('unexpectedError'));
          setLoading(false);
          return;
        }
        installSession(result.staff, setStaff);
        router.push('/');
        return;
      }
      setError(result.error === 'unexpected' ? t('unexpectedError') : t('loginFailed'));
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'cafe-login-form' } });
      setError(t('unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <GustriLogo className="h-14 w-14" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">{t('cafeLogin.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{cafeName}</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <form className="space-y-5" onSubmit={handleLogin}>
            <label className="block text-sm font-medium text-gray-700">
              {t('cafeLogin.username')}
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
                autoComplete="username"
                autoCapitalize="none"
                className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-primary-400 focus:outline-none disabled:opacity-50"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              {t('cafeLogin.password')}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-primary-400 focus:outline-none disabled:opacity-50"
              />
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!isValid || loading}
              className="w-full rounded-lg bg-primary-500 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
            >
              {loading ? t('cafeLogin.signingIn') : t('cafeLogin.signIn')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
