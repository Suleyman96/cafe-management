'use client';

import { useTranslation } from '@cafe-idare/i18n';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/use-auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'waiter' | 'admin' | 'kitchen' | 'owner';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { t } = useTranslation('auth');
  const { staff, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && staff && requiredRole) {
      if (staff.role !== requiredRole && staff.role !== 'admin' && staff.role !== 'owner') {
        // Admins can access everything, but others need specific role
        router.push('/');
      }
    }
  }, [isLoading, isAuthenticated, staff, requiredRole, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner fullScreen />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  if (requiredRole && staff) {
    if (staff.role !== requiredRole && staff.role !== 'admin' && staff.role !== 'owner') {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {t('accessDenied', { ns: 'auth' })}
            </h1>
            <p className="text-gray-600">{t('noPermission', { ns: 'auth' })}</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
