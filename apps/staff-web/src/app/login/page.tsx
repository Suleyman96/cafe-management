'use client';

import { useTranslation } from '@gustri/i18n';
import { GustriLogo } from '@gustri/ui-web';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { type SignInErrorCode, signInAction } from './actions';

const ERROR_KEY_BY_CODE: Record<SignInErrorCode, string> = {
  invalid_credentials: 'loginFailed',
  no_active_staff: 'noActiveStaff',
  unexpected: 'unexpectedError',
};

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation('auth');
  const { staff } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (staff) {
      router.push('/');
    }
  }, [staff, router]);

  const isValid = email.trim().length > 0 && password.length > 0;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading) return;
    setError('');
    setLoading(true);

    try {
      const result = await signInAction(email, password);

      if (result.ok) {
        // The action's HTTP response already carried the `Set-Cookie`
        // headers for the new session — the browser committed them
        // before this promise resolved. `router.push('/')` is therefore
        // race-free: middleware's `getSession()` will see the cookie on
        // its first read.
        router.push('/');
        return;
      }

      setError(t(ERROR_KEY_BY_CODE[result.error]));
      setLoading(false);
    } catch (err) {
      // Network/transport failures invoking the action. The action
      // itself catches everything internally and returns an error code.
      Sentry.captureException(err);
      setError(t('unexpectedError'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <GustriLogo size={56} showText={false} />
        </div>
        <h1 className="mt-4 text-center text-3xl font-bold text-gray-900">{t('appTitle')}</h1>
        <p className="mt-1 text-center text-sm text-gray-500">{t('serviceName')}</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/80 backdrop-blur-sm py-8 px-4 shadow-xl rounded-2xl sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {t('emailAddress')}
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
                  placeholder={t('placeholderEmail')}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  {t('password')}
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  {t('forgotPassword')}
                </Link>
              </div>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
                  placeholder={t('placeholderPassword')}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={!isValid || loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-xl"
              >
                {loading ? t('signingIn') : t('signIn')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
