'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { Sidebar } from '@/components/layout/sidebar';
import { UserMenu } from '@/components/layout/user-menu';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-50">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          {/* Top header with user menu */}
          <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-end">
            <UserMenu />
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
