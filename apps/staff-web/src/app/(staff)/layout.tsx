'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Sidebar } from '@/components/layout/sidebar';
import { Menu, X } from 'lucide-react';

const SIDEBAR_STORAGE_KEY = 'cafe-sidebar-collapsed';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved !== null) {
      setSidebarCollapsed(saved === 'true');
    }
  }, []);

  // Close mobile menu on route change or resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    const newValue = !sidebarCollapsed;
    setSidebarCollapsed(newValue);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(newValue));
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-50">
        {/* Mobile Header */}
        <div className="fixed top-0 left-0 right-0 z-40 lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Cafe Idare</h1>
            <p className="text-xs text-gray-500">Staff Portal</p>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar - Hidden on mobile, shown on lg+ */}
        <div className="hidden lg:block">
          <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        </div>

        {/* Mobile Sidebar Drawer */}
        <div
          className={`fixed inset-y-0 left-0 z-50 lg:hidden transform transition-transform duration-300 ease-in-out ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar
            isCollapsed={false}
            onToggle={() => {}}
            isMobile={true}
            onMobileClose={() => setMobileMenuOpen(false)}
          />
        </div>

        {/* Main content area */}
        <main className="flex-1 overflow-auto pt-16 lg:pt-0">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
