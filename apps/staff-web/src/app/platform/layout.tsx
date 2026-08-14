'use client';

import { useTranslation } from '@gustri/i18n';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/protected-route';

/**
 * Operator (platform-admin) shell — deliberately NOT the tenant app layout.
 * No tenant sidebar; a distinct dark "back office" header signals this is the
 * gustri operator console, not a tenant screen. Auth is still required
 * (ProtectedRoute); the platform-admin allowlist gate lives on the page + its
 * API routes, so a signed-in non-operator lands here and sees "access denied".
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('staff');
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-gray-900 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary-400" />
              <span className="font-semibold">gustri</span>
              <span className="rounded bg-primary-500/20 px-2 py-0.5 text-xs font-medium text-primary-200">
                {t('platform.title')}
              </span>
            </div>
            <Link
              href="/tables"
              className="flex items-center gap-1 text-sm text-gray-300 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('platform.backToApp')}
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
