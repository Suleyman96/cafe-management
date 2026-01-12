'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  UtensilsCrossed,
  ClipboardList,
  ChefHat,
  Bell,
  MessageSquare,
  BarChart3,
  Menu,
  Users,
} from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: '/tables', label: 'Tables', icon: <UtensilsCrossed className="h-5 w-5" /> },
  { href: '/orders', label: 'Orders', icon: <ClipboardList className="h-5 w-5" /> },
  { href: '/kitchen', label: 'Kitchen', icon: <ChefHat className="h-5 w-5" /> },
  { href: '/calls', label: 'Waiter Calls', icon: <Bell className="h-5 w-5" /> },
  { href: '/feedback', label: 'Feedback', icon: <MessageSquare className="h-5 w-5" /> },
  { href: '/menu', label: 'Menu', icon: <Menu className="h-5 w-5" />, adminOnly: true },
  { href: '/staff', label: 'Staff', icon: <Users className="h-5 w-5" />, adminOnly: true },
  { href: '/reports', label: 'Reports', icon: <BarChart3 className="h-5 w-5" />, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { staff } = useAuth();

  const isAdmin = staff?.role === 'admin';

  // Filter nav items based on role
  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Cafe Idare</h1>
        <p className="text-xs text-gray-500">Staff Portal</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className={isActive ? 'text-blue-600' : 'text-gray-500'}>
                    {item.icon}
                  </span>
                  {item.label}
                  {item.adminOnly && (
                    <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                      Admin
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Role indicator at bottom */}
      {staff && (
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            Logged in as <span className="font-medium capitalize">{staff.role}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
