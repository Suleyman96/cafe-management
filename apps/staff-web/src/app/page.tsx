'use client';

import { LoadingSpinner } from '@gustri/ui-web';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useCafeSettings } from '@/hooks';

export default function HomePage() {
  const router = useRouter();
  const { data: settings, isLoading, isError } = useCafeSettings();

  useEffect(() => {
    if (isLoading) return;
    // First-run tenants (onboarding not finished) land on the getting-started
    // checklist; everyone else goes to the main working area. On error, don't
    // trap them on a spinner — fall through to the app.
    if (settings && !settings.onboarding_completed_at && !isError) {
      router.replace('/onboarding');
    } else {
      router.replace('/tables');
    }
  }, [router, settings, isLoading, isError]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner />
    </div>
  );
}
