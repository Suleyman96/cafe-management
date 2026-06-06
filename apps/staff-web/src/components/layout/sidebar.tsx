'use client';

import { getLocalDateString } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { invalidateSchedules, useTenantId } from '@gustri/queries';
import { GustriIcon, GustriLogo, getRoleBadgeColor } from '@gustri/ui-web';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  ListTodo,
  LogIn,
  LogOut,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { usePendingApprovalCount } from '@/hooks/use-orders-safe';
import { useMyScheduleToday } from '@/hooks/use-schedules-safe';
import { useMyTasks, useOverdueTasksCount } from '@/hooks/use-tasks-safe';
import { supabase } from '@/lib/supabase/client';
import { useVisibleNavItems } from './use-visible-nav-items';

const SIDEBAR_GROUPS_STORAGE_KEY = 'gustri:sidebar:collapsedGroups';

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
  // Avoid clobbering localStorage with the initial {} before the load effect
  // runs. Save only writes after the first load tick has completed.
  const collapsedGroupsLoadedRef = useRef(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { data: overdueCount = 0 } = useOverdueTasksCount();
  const pendingApprovalCount = usePendingApprovalCount();

  // Visible nav groups (plan + permission + feature gates applied). Policy
  // lives in the hook so it stays unit-testable and the render path clean.
  const visibleGroups = useVisibleNavItems();

  const isGroupCollapsed = (groupKey: string) => {
    // User toggle wins. Without this, the active-page auto-expand below
    // re-expands the group on every render while the user is on one of
    // its routes, making the chevron appear non-functional.
    const userPref = collapsedGroups[groupKey];
    if (userPref !== undefined) return userPref;

    // Default: auto-expand groups containing the active route.
    const group = visibleGroups.find((g) => g.key === groupKey);
    if (group) {
      const hasActivePage = group.items.some(
        (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)),
      );
      if (hasActivePage) return false;
    }
    return false;
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // Persist collapsed-group preferences across page reloads.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SIDEBAR_GROUPS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setCollapsedGroups(parsed as Record<string, boolean>);
        }
      }
    } catch {
      // Storage unavailable (private mode, quota, JSON corrupt) — fall back
      // to in-memory state. Sidebar still works, just doesn't persist.
    }
    collapsedGroupsLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!collapsedGroupsLoadedRef.current) return;
    try {
      window.localStorage.setItem(SIDEBAR_GROUPS_STORAGE_KEY, JSON.stringify(collapsedGroups));
    } catch {
      // Storage write failed — preferences are session-only this run.
    }
  }, [collapsedGroups]);

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

  const handleNavClick = () => {
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <aside
      // `h-dvh` (dynamic viewport height) instead of `h-screen` — on iOS,
      // 100vh is the URL-bar-collapsed value, so the aside extends below
      // the actually visible area and the bottom items (user menu, shift
      // indicator, lower nav rows) become unreachable. 100dvh tracks the
      // visible viewport so the inner `<nav flex-1 overflow-y-auto>` is
      // bounded correctly and scrolls when items don't fit.
      className={`bg-white border-r border-gray-200 h-dvh sticky top-0 flex flex-col transition-all duration-300 ${
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
      (task) =>
        (task.status === 'pending' || task.status === 'in_progress') && task.due_date === today,
    ) || [];

  if (activeTasks.length === 0) return null;

  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  const displayTasks = [...activeTasks]
    .sort(
      (a, b) =>
        (priorityOrder[a.priority ?? 'normal'] ?? 3) - (priorityOrder[b.priority ?? 'normal'] ?? 3),
    )
    .slice(0, 3);

  const isOverdue = (task: { due_date: string | null }) => task.due_date && task.due_date < today;

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
          {displayTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-1.5 text-gray-700">
              <span
                className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${isOverdue(task) ? 'bg-red-500' : priorityDot[task.priority ?? 'normal'] || priorityDot.normal}`}
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

const SHIFT_STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-gray-50 border-gray-200 text-gray-600',
  in_progress: 'bg-blue-50 border-blue-200 text-blue-700',
  completed: 'bg-green-50 border-green-200 text-green-700',
  missed: 'bg-red-50 border-red-200 text-red-700',
};

const SHIFT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'scheduled',
  in_progress: 'onShift',
  completed: 'shiftCompleted',
  missed: 'shiftMissed',
};

function TodayShiftIndicator({ staffId }: { staffId: string }) {
  const { data: todaySchedules, refetch } = useMyScheduleToday(staffId);
  const { t } = useTranslation('nav');
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  const [clockingOut, setClockingOut] = useState<string | null>(null);

  if (!todaySchedules || todaySchedules.length === 0) return null;

  const handleClockOut = async (scheduleId: string) => {
    setClockingOut(scheduleId);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch('/api/v1/schedules/clock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ scheduleId, action: 'clock_out' }),
      });

      if (res.ok) {
        toast.success(t('clockedOut'));
        invalidateSchedules(queryClient, tenantId);
        refetch();
      } else {
        const data = await res.json();
        toast.error(data.error || t('clockOutFailed'));
      }
    } catch {
      toast.error(t('clockOutFailed'));
    } finally {
      setClockingOut(null);
    }
  };

  // Sort: in_progress first, then scheduled, then completed/missed
  const sortOrder: Record<string, number> = {
    in_progress: 0,
    scheduled: 1,
    completed: 2,
    missed: 3,
  };
  const sorted = [...todaySchedules].sort(
    (a, b) => (sortOrder[a.status] ?? 9) - (sortOrder[b.status] ?? 9),
  );

  return (
    <div className="mx-2 mb-2 space-y-1.5">
      {sorted.map((shift) => (
        <div
          key={shift.id}
          className={`px-3 py-2 rounded-lg border text-xs ${SHIFT_STATUS_COLORS[shift.status] || SHIFT_STATUS_COLORS.scheduled}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-medium">
              <Clock className="h-3 w-3" />
              {t(SHIFT_STATUS_LABELS[shift.status] || 'offShift')}
            </div>
            {shift.status === 'in_progress' && (
              <button
                type="button"
                onClick={() => handleClockOut(shift.id)}
                disabled={clockingOut === shift.id}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 hover:bg-blue-200 text-blue-800 transition-colors disabled:opacity-50"
                title={t('clockOut')}
              >
                <LogIn className="h-2.5 w-2.5" />
                {clockingOut === shift.id ? '...' : t('clockOut')}
              </button>
            )}
          </div>
          <div className="mt-0.5">
            {shift.planned_start?.slice(0, 5)} - {shift.planned_end?.slice(0, 5)}
          </div>
        </div>
      ))}
    </div>
  );
}
