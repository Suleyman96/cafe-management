'use client';

import {
  BarChart3,
  Bell,
  CalendarDays,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  Store,
  Truck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CafeManIcon, CafeManLogo } from '@/components/ui/cafe-man-logo';
import { useAuth } from '@/hooks/use-auth';
import { useMyScheduleToday } from '@/hooks/use-schedules-safe';

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: '/tables', label: 'Tables', icon: <UtensilsCrossed className="h-5 w-5" /> },
  { href: '/orders', label: 'Orders', icon: <ClipboardList className="h-5 w-5" /> },
  { href: '/delivery', label: 'Delivery', icon: <Truck className="h-5 w-5" /> },
  { href: '/kitchen', label: 'Kitchen', icon: <ChefHat className="h-5 w-5" /> },
  { href: '/calls', label: 'Waiter Calls', icon: <Bell className="h-5 w-5" /> },
  { href: '/feedback', label: 'Feedback', icon: <MessageSquare className="h-5 w-5" /> },
  { href: '/stock', label: 'Stock', icon: <Package className="h-5 w-5" />, adminOnly: true },
  { href: '/expenses', label: 'Expenses', icon: <Receipt className="h-5 w-5" />, adminOnly: true },
  { href: '/menu', label: 'Menu', icon: <Menu className="h-5 w-5" />, adminOnly: true },
  { href: '/staff', label: 'Staff', icon: <Users className="h-5 w-5" />, adminOnly: true },
  {
    href: '/schedules',
    label: 'Schedules',
    icon: <CalendarDays className="h-5 w-5" />,
    adminOnly: true,
  },
  {
    href: '/cafe-settings',
    label: 'Cafe Settings',
    icon: <Store className="h-5 w-5" />,
    adminOnly: true,
  },
  { href: '/reports', label: 'Reports', icon: <BarChart3 className="h-5 w-5" />, adminOnly: true },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ isCollapsed, onToggle, isMobile, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { staff, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isAdmin = staff?.role === 'admin';

  // Filter nav items based on role
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'waiter':
        return 'bg-blue-100 text-blue-800';
      case 'kitchen':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleNavClick = () => {
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <aside
      className={`bg-white border-r border-gray-200 min-h-screen flex flex-col transition-all duration-300 ${
        isCollapsed && !isMobile ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between relative">
        <Link href="/" onClick={handleNavClick} className="hover:opacity-80 transition-opacity">
          {!isCollapsed || isMobile ? (
            <CafeManLogo size={36} showText={true} />
          ) : (
            <CafeManIcon size={32} />
          )}
        </Link>
        {!isMobile && !isCollapsed && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {!isMobile && isCollapsed && (
          <button
            onClick={onToggle}
            className="absolute -right-3 top-6 p-1 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 text-gray-500 transition-colors z-10"
            title="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={handleNavClick}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                  } ${isCollapsed && !isMobile ? 'justify-center' : ''}`}
                  title={isCollapsed && !isMobile ? item.label : undefined}
                >
                  <span className={isActive ? 'text-blue-600' : 'text-gray-500'}>{item.icon}</span>
                  {(!isCollapsed || isMobile) && (
                    <>
                      {item.label}
                      {item.adminOnly && (
                        <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Today's Shift Indicator */}
      {staff && (!isCollapsed || isMobile) && <TodayShiftIndicator staffId={staff.id} />}

      {/* User Menu at bottom */}
      {staff && (
        <div className="relative border-t border-gray-200" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className={`w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
              isCollapsed && !isMobile ? 'justify-center' : ''
            }`}
            title={isCollapsed && !isMobile ? staff.full_name : undefined}
          >
            <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
              {staff.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            {(!isCollapsed || isMobile) && (
              <>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{staff.full_name}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(staff.role)}`}
                  >
                    {staff.role}
                  </span>
                </div>
                <ChevronUp
                  className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${isUserMenuOpen ? '' : 'rotate-180'}`}
                />
              </>
            )}
          </button>

          {/* Dropdown Menu */}
          {isUserMenuOpen && (
            <div
              className={`absolute bottom-full mb-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 ${
                isCollapsed && !isMobile ? 'left-full ml-2 w-56' : 'left-2 right-2'
              }`}
            >
              {isCollapsed && !isMobile && (
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{staff.full_name}</p>
                  <p className="text-xs text-gray-500">{staff.email}</p>
                </div>
              )}

              <Link
                href="/settings"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  handleNavClick();
                }}
                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Settings className="h-4 w-4" />
                Account Settings
              </Link>

              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function TodayShiftIndicator({ staffId }: { staffId: string }) {
  const { data: todaySchedules } = useMyScheduleToday(staffId);

  if (!todaySchedules || todaySchedules.length === 0) return null;

  const shift = todaySchedules[0] as any;
  const statusColors: Record<string, string> = {
    scheduled: 'bg-gray-50 border-gray-200 text-gray-600',
    in_progress: 'bg-blue-50 border-blue-200 text-blue-700',
    completed: 'bg-green-50 border-green-200 text-green-700',
    missed: 'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <div
      className={`mx-2 mb-2 px-3 py-2 rounded-lg border text-xs ${statusColors[shift.status] || statusColors.scheduled}`}
    >
      <div className="flex items-center gap-1.5 font-medium">
        <Clock className="h-3 w-3" />
        Today&apos;s Shift
      </div>
      <div className="mt-0.5">
        {shift.planned_start?.slice(0, 5)} - {shift.planned_end?.slice(0, 5)}
      </div>
    </div>
  );
}
