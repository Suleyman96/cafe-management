'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@cafe-idare/ui';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to tables page as the main working area
    router.replace('/tables');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner />
    </div>
  );
}
