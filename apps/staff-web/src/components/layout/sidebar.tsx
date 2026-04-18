'use client';

import type { PlanName } from '@gustri/core';
import { getLocalDateString, PLAN_ORDER } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { GustriIcon, GustriLogo } from '@gustri/ui';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock,
  ListTodo,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  Store,
  Trash2,
  Truck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePendingApprovalCount } from '@/hooks/use-orders-safe';
import { useMyScheduleToday } from '@/hooks/use-schedules-safe';
import { useCafeSettings } from '@/hooks/use-settings-safe';
import { useMyTasks, useOverdueTasksCount } from '@/hooks/use-tasks-safe';
import { useTenantPlan } from '@/hooks/use-tenant-plan';

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  ownerOnly?: boolean;
  minPlan?: PlanName;
};

type NavGroup = {
  key: string;
  labelKey: string;
  collapsible: boolean;
  adminOnly?: boolean;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    key: 'main',
    labelKey: 'mainSection',
    collapsible: false,
    items: [
      { href: '/tables', labelKey: 'tables', icon: <UtensilsCrossed className="h-5 w-5" /> },
      { href: '/orders', labelKey: 'orders', icon: <ClipboardList className="h-5 w-5" /> },
      { href: '/delivery', labelKey: 'delivery', icon: <Truck className="h-5 w-5" /> },
      { href: '/takeout', labelKey: 'takeout', icon: <Package className="h-5 w-5" /> },
      { href: '/kitchen', labelKey: 'kitchen', icon: <ChefHat className="h-5 w-5" /> },
      { href: '/calls', labelKey: 'waiterCalls', icon: <Bell className="h-5 w-5" /> },
      {
        href: '/tasks',
        labelKey: 'tasks',
        icon: <ListTodo className="h-5 w-5" />,
        minPlan: 'pro' as PlanName,
      },
    ],
  },
  {
    key: 'management',
    labelKey: 'managementSection',
    collapsible: true,
    items: [
      {
        href: '/feedback',
        labelKey: 'feedback',
        icon: <MessageSquare className="h-5 w-5" />,
        adminOnly: true,
      },
      {
        href: '/stock',
        labelKey: 'stock',
        icon: <Package className="h-5 w-5" />,
        adminOnly: true,
        minPlan: 'pro' as PlanName,
      },
      {
        href: '/waste',
        labelKey: 'waste',
        icon: <Trash2 className="h-5 w-5" />,
        adminOnly: true,
        minPlan: 'pro' as PlanName,
      },
      {
        href: '/expenses',
        labelKey: 'expenses',
        icon: <Receipt className="h-5 w-5" />,
        adminOnly: true,
      },
    ],
  },
  {
    key: 'admin',
    labelKey: 'adminSection',
    collapsible: true,
    adminOnly: true,
    items: [
      { href: '/staff', labelKey: 'staff', icon: <Users className="h-5 w-5" /> },
      { href: '/menu', labelKey: 'menu', icon: <Menu className="h-5 w-5" /> },
      {
        href: '/schedules',
        labelKey: 'schedules',
        icon: <CalendarDays className="h-5 w-5" />,
        minPlan: 'pro' as PlanName,
      },
      {
        href: '/reports',
        labelKey: 'reports',
        icon: <BarChart3 className="h-5 w-5" />,
        ownerOnly: true,
      },
      {
        href: '/cafe-settings',
        labelKey: 'cafeSettings',
        icon: <Store className="h-5 w-5" />,
      },
    ],
  },
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
  const { t: tNav } = useTranslation('nav');
  const { t: tRoles } = useTranslation('roles');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { data: overdueCount = 0 } = useOverdueTasksCount();
  const pendingApprovalCount = usePendingApprovalCount();
  const { data: cafeSettings } = useCafeSettings();
  const tenantPlan = useTenantPlan();

  const isOwner = staff?.role === 'owner';
  const isAdmin = staff?.role === 'admin' || isOwner;

  const filterItems = (items: NavItem[]) =>
    items.filter((item) => {
      if (item.ownerOnly && !isOwner) return false;
      if (item.adminOnly && !isAdmin) return false;
      if (item.minPlan && PLAN_ORDER[tenantPlan] < PLAN_ORDER[item.minPlan]) return false;
      if (item.href === '/waste' && !cafeSettings?.waste_tracking_enabled) return false;
      return true;
    });

  // Build visible groups with filtered items
  const visibleGroups = navGroups
    .filter((group) => {
      if (group.adminOnly && !isAdmin) return false;
      return true;
    })
    .map((group) => ({ ...group, items: filterItems(group.items) }))
    .filter((group) => group.items.length > 0);

  const isGroupCollapsed = (groupKey: string) => {
    // Auto-expand if active page is in this group
    const group = visibleGroups.find((g) => g.key === groupKey);
    if (group) {
      const hasActivePage = group.items.some(
        (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)),
      );
      if (hasActivePage) return false;
    }
    return collapsedGroups[groupKey] ?? false;
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

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
      case 'owner':
        return 'bg-emerald-100 text-emerald-800';
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
      className={`bg-white border-r border-gray-200 h-screen sticky top-0 flex flex-col transition-all duration-300 ${
        isCollapsed && !isMobile ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between relative">
        <Link href="/" onClick={handleNavClick} className="hover:opacity-80 transition-opacity">
          {!isCollapsed || isMobile ? (
            <GustriLogo size={36} showText={true} />
          ) : (
            <GustriIcon size={32} />
          )}
        </Link>
        {!isMobile && !isCollapsed && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            title={tNav('collapseSidebar')}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {!isMobile && isCollapsed && (
          <button
            onClick={onToggle}
            className="absolute -right-3 top-6 p-1 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 text-gray-500 transition-colors z-10"
            title={tNav('expandSidebar')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {visibleGroups.map((group) => {
          const collapsed = isGroupCollapsed(group.key);
          const showHeader = group.collapsible && (!isCollapsed || isMobile);

          return (
            <div key={group.key}>
              {/* Group header */}
              {showHeader && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="flex items-center justify-between w-full px-3 py-1.5 mt-3 text-xs font-semibold uppercase text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {tNav(group.labelKey)}
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`}
                  />
                </button>
              )}

              {/* Group items */}
              {(!group.collapsible || !collapsed || (isCollapsed && !isMobile)) && (
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/' && pathname.startsWith(item.href));
                    const label = tNav(item.labelKey);

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={handleNavClick}
                          className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-100'
                          } ${isCollapsed && !isMobile ? 'justify-center' : ''}`}
                          title={isCollapsed && !isMobile ? label : undefined}
                        >
                          <span className={isActive ? 'text-blue-600' : 'text-gray-500'}>
                            {item.icon}
                          </span>
                          {(!isCollapsed || isMobile) && (
                            <>
                              {label}
                              {item.href === '/orders' && pendingApprovalCount > 0 && (
                                <span className="ml-auto text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center animate-pulse">
                                  {pendingApprovalCount}
                                </span>
                              )}
                              {item.href === '/tasks' && overdueCount > 0 && (
                                <span className="ml-auto text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                                  {overdueCount}
                                </span>
                              )}
                            </>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* My Tasks + Today's Shift */}
      {staff && (!isCollapsed || isMobile) && (
        <>
          <MyTasksIndicator staffId={staff.id} />
          <TodayShiftIndicator staffId={staff.id} />
        </>
      )}

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
                    {tRoles(staff.role)}
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
                {tNav('settings')}
              </Link>

              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                {tNav('logout')}
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function MyTasksIndicator({ staffId }: { staffId: string }) {
  const { data: myTasks } = useMyTasks(staffId);
  const { t } = useTranslation('nav');

  const today = getLocalDateString();
  const activeTasks =
    myTasks?.filter(
      (t: any) => (t.status === 'pending' || t.status === 'in_progress') && t.due_date === today,
    ) || [];

  if (activeTasks.length === 0) return null;

  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  const displayTasks = [...activeTasks]
    .sort((a: any, b: any) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3))
    .slice(0, 3);

  const isOverdue = (task: any) => task.due_date && task.due_date < today;

  const priorityDot: Record<string, string> = {
    urgent: 'bg-red-500',
    high: 'bg-orange-500',
    normal: 'bg-blue-500',
    low: 'bg-gray-400',
  };

  return (
    <Link href="/tasks?tab=my" className="block mx-2 mb-2">
      <div className="px-3 py-2 rounded-lg border bg-amber-50 border-amber-200 text-xs hover:bg-amber-100 transition-colors">
        <div className="flex items-center justify-between font-medium text-amber-800">
          <div className="flex items-center gap-1.5">
            <ListTodo className="h-3 w-3" />
            {t('myTasks')}
          </div>
          <span className="text-amber-600">{activeTasks.length}</span>
        </div>
        <div className="mt-1.5 space-y-1">
          {displayTasks.map((task: any) => (
            <div key={task.id} className="flex items-center gap-1.5 text-gray-700">
              <span
                className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${isOverdue(task) ? 'bg-red-500' : priorityDot[task.priority] || priorityDot.normal}`}
              />
              <span className={`truncate ${isOverdue(task) ? 'text-red-600' : ''}`}>
                {task.title}
              </span>
            </div>
          ))}
          {activeTasks.length > 3 && (
            <div className="text-amber-600">
              {t('moreTasksCount', { count: activeTasks.length - 3 })}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function TodayShiftIndicator({ staffId }: { staffId: string }) {
  const { data: todaySchedules } = useMyScheduleToday(staffId);
  const { t } = useTranslation('nav');

  if (!todaySchedules || todaySchedules.length === 0) return null;

  const shift = todaySchedules[0];
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
        {shift.status === 'in_progress' ? t('onShift') : t('offShift')}
      </div>
      <div className="mt-0.5">
        {shift.planned_start?.slice(0, 5)} - {shift.planned_end?.slice(0, 5)}
      </div>
    </div>
  );
}
