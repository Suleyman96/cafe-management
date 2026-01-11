'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Login page - redirects to home (no auth required)
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Just redirect to home - no login needed
    router.push('/');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}
