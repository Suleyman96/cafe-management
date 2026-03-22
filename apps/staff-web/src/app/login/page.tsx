'use client';

import { useTranslation } from '@cafe-idare/i18n';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CafeManLogo } from '@/components/ui/cafe-man-logo';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation('auth');
  const { staff, setStaff } = useAuthStore();

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError(t('loginFailed'));
        setLoading(false);
        return;
      }

      // Fetch staff record linked to this auth user
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('auth_user_id', authData.user.id)
        .eq('is_active', true)
        .single();

      if (staffError || !staffData) {
        // Sign out if no valid staff record
        await supabase.auth.signOut();
        setError(t('noActiveStaff'));
        setLoading(false);
        return;
      }

      // Set staff in store and redirect
      setStaff(staffData);

      // Fire-and-forget: update last_login_at
      (supabase.from('staff') as any)
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', (staffData as any).id)
        .then();

      // Fire-and-forget: fill actual_start for today's schedule
      const today = new Date().toISOString().split('T')[0];
      (supabase.from('staff_schedules') as any)
        .update({ actual_start: new Date().toISOString(), status: 'in_progress' })
        .eq('staff_id', (staffData as any).id)
        .eq('date', today)
        .eq('status', 'scheduled')
        .then();

      router.push('/');
    } catch (err) {
      console.error('Login error:', err);
      setError(t('unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <CafeManLogo size={56} showText={false} />
        </div>
        <h1 className="mt-4 text-center text-3xl font-bold text-gray-900">{t('cafeManTitle')}</h1>
        <p className="mt-1 text-center text-sm text-gray-500">{t('staffPortal')}</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/80 backdrop-blur-sm py-8 px-4 shadow-xl rounded-2xl sm:px-10 border border-gray-100">
          <form method="post" action="" className="space-y-6" onSubmit={handleLogin}>
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
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
                  placeholder={t('placeholderEmail')}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {t('password')}
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
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
                disabled={loading}
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
