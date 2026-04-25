'use client';

import { getLocalDateString, getRoleBadgeColor } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { Button, LoadingSpinner } from '@gustri/ui';
import {
  ArrowLeft,
  Calendar,
  ChefHat,
  Clock,
  CreditCard,
  Edit2,
  Key,
  Mail,
  Phone,
  Shield,
  ShoppingBag,
  TrendingUp,
  User,
  UserCheck,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { StaffEditModal } from '@/components/modals/staff-edit-modal';
import { StaffResetPasswordModal } from '@/components/modals/staff-reset-password-modal';
import { useMySchedule, useOrders, usePaymentsByStaff, useStaffMember } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { useFormatPrice } from '@/hooks/use-format-price';

import type { StaffSchedule } from '@/types';

function calculateHoursWorked(schedules: StaffSchedule[] | undefined) {
  if (!schedules) return 0;
  let total = 0;
  for (const sched of schedules) {
    if (sched.actual_start) {
      const start = new Date(sched.actual_start).getTime();
      const end = sched.actual_end
        ? new Date(sched.actual_end).getTime()
        : sched.status === 'in_progress'
          ? Date.now()
          : 0;
      if (end > start) {
        total += (end - start) / (1000 * 60 * 60);
      }
    }
  }
  return Math.round(total * 10) / 10;
}

export default function StaffDetailPage() {
  const params = useParams();
  const staffId = params.id as string;
  const { staff: currentUser } = useAuth();
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');

  const {
    data: staffMember,
    isLoading: staffLoading,
    refetch: refetchStaff,
  } = useStaffMember(staffId);
  const { data: allOrders, isLoading: ordersLoading } = useOrders();
  const { data: recentPayments, isLoading: paymentsLoading } = usePaymentsByStaff(staffId);
  const formatPrice = useFormatPrice();

  // Schedule date ranges (computed once on mount)
  const todayStr = useMemo(() => getLocalDateString(), []);
  const startOfWeek = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return getLocalDateString(d);
  }, []);
  const endOfWeek = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 0 : 7 - day;
    d.setDate(d.getDate() + diff);
    return getLocalDateString(d);
  }, []);
  const startOfMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);
  const endOfMonth = useMemo(() => {
    const d = new Date();
    return getLocalDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  }, []);
  const nextWeekDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return getLocalDateString(d);
  }, []);

  const { data: weekSchedules } = useMySchedule(staffId, startOfWeek, endOfWeek);
  const { data: monthSchedules } = useMySchedule(staffId, startOfMonth, endOfMonth);
  const { data: upcomingSchedules } = useMySchedule(staffId, todayStr, nextWeekDate);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);

  const weeklyHours = useMemo(() => calculateHoursWorked(weekSchedules), [weekSchedules]);
  const monthlyHours = useMemo(() => calculateHoursWorked(monthSchedules), [monthSchedules]);

  // Calculate performance stats from orders
  const { stats, recentOrders } = useMemo(() => {
    if (!allOrders) return { stats: null, recentOrders: [] };

    const staffOrders = allOrders.filter((order) => order.assigned_waiter_id === staffId);

    let totalRevenue = 0;
    let totalItemsSold = 0;
    let completedOrders = 0;

    for (const order of staffOrders) {
      const orderTotal =
        order.order_items?.reduce((sum, item) => sum + item.quantity * item.item_price, 0) || 0;

      const itemCount = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

      totalRevenue += orderTotal;
      totalItemsSold += itemCount;
      if (order.status === 'closed') completedOrders++;
    }

    const completionRate =
      staffOrders.length > 0 ? Math.round((completedOrders / staffOrders.length) * 100) : 0;

    return {
      stats: {
        ordersHandled: staffOrders.length,
        revenue: totalRevenue,
        itemsSold: totalItemsSold,
        completionRate,
      },
      recentOrders: staffOrders.slice(0, 10),
    };
  }, [allOrders, staffId]);

  // Only admins can access this page
  if (currentUser?.role !== 'admin' && currentUser?.role !== 'owner') {
    return (
      <div className="p-3 sm:p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
          {t('staffMgmt.accessDenied')}
        </div>
      </div>
    );
  }

  if (staffLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!staffMember) {
    return (
      <div className="p-3 sm:p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
          {t('staffMgmt.noStaff')}
        </div>
      </div>
    );
  }

  const member = staffMember;

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-5 w-5" />;
      case 'kitchen':
        return <ChefHat className="h-5 w-5" />;
      default:
        return <User className="h-5 w-5" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      preparing: 'bg-blue-100 text-blue-800',
      ready: 'bg-green-100 text-green-800',
      served: 'bg-indigo-100 text-indigo-800',
      closed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Back button */}
      <Link
        href="/staff"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        {tCommon('back')} {t('staffMgmt.title')}
      </Link>

      {/* Profile Card */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              {getRoleIcon(member.role)}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{member.full_name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(member.role)}`}
                >
                  {getRoleIcon(member.role)}
                  {member.role}
                </span>
                {member.is_active ? (
                  <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                    <UserCheck className="h-3 w-3" />
                    {tCommon('active')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
                    <UserX className="h-3 w-3" />
                    {tCommon('inactive')}
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-1 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  {member.email}
                </div>
                {member.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" />
                    {member.phone}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  {t('staffMgmt.memberSince')} {new Date(member.created_at).toLocaleDateString()}
                </div>
                {member.last_login_at && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    {t('staffMgmt.lastLogin')} {new Date(member.last_login_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditModal(true)}
              className="text-xs"
            >
              <Edit2 className="h-3.5 w-3.5 mr-1" />
              {tCommon('edit')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetPasswordModal(true)}
              className="text-xs"
            >
              <Key className="h-3.5 w-3.5 mr-1" />
              {t('staffMgmt.resetPassword')}
            </Button>
          </div>
        </div>
      </div>

      {/* Performance Stats */}
      {!ordersLoading && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <ShoppingBag className="h-4 w-4" />
              <span className="text-xs font-medium uppercase text-gray-500">
                {t('reports.ordersHandled')}
              </span>
            </div>
            <p className="text-2xl font-bold">{stats.ordersHandled}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium uppercase text-gray-500">
                {t('reports.revenue')}
              </span>
            </div>
            <p className="text-2xl font-bold">{formatPrice(stats.revenue)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <ShoppingBag className="h-4 w-4" />
              <span className="text-xs font-medium uppercase text-gray-500">
                {t('reports.itemsSold')}
              </span>
            </div>
            <p className="text-2xl font-bold">{stats.itemsSold}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <UserCheck className="h-4 w-4" />
              <span className="text-xs font-medium uppercase text-gray-500">
                {t('reports.completionRate')}
              </span>
            </div>
            <p className="text-2xl font-bold">{stats.completionRate}%</p>
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 sm:px-6 py-3 border-b">
          <h2 className="text-lg font-semibold">{t('staffMgmt.recentOrders')}</h2>
        </div>
        {ordersLoading ? (
          <div className="p-6 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">{t('staffMgmt.noOrders')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('staffMgmt.orderNumber')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('staffMgmt.table')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {tCommon('status')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('tables.items')}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    {tCommon('total')}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    {tCommon('date')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentOrders.map((order) => {
                  const orderTotal =
                    order.order_items?.reduce(
                      (sum, item) => sum + item.quantity * item.item_price,
                      0,
                    ) || 0;
                  const itemCount =
                    order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">
                        #{order.order_number || order.id.slice(0, 6)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {order.table?.table_number
                          ? `${t('staffMgmt.table')} ${order.table.table_number}`
                          : '-'}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(order.status)}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">{itemCount}</td>
                      <td className="px-4 py-2 text-sm text-right font-medium">
                        {formatPrice(orderTotal)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-500">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 sm:px-6 py-3 border-b">
          <h2 className="text-lg font-semibold">{t('staffMgmt.recentPayments')}</h2>
        </div>
        {paymentsLoading ? (
          <div className="p-6 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : !recentPayments || recentPayments.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">{t('staffMgmt.noPayments')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('orders.order')}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    {tCommon('amount')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('expenses.paymentMethod')}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    {tCommon('date')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">
                      #{payment.order_id?.slice(0, 6) || '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium">
                      {formatPrice(payment.amount)}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                        <CreditCard className="h-3 w-3" />
                        {payment.payment_method || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-500">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hours Worked */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium uppercase text-gray-500">
              {tCommon('thisWeek')}
            </span>
          </div>
          <p className="text-2xl font-bold">{weeklyHours}h</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <Calendar className="h-4 w-4" />
            <span className="text-xs font-medium uppercase text-gray-500">
              {tCommon('thisMonth')}
            </span>
          </div>
          <p className="text-2xl font-bold">{monthlyHours}h</p>
        </div>
      </div>

      {/* Upcoming Schedule */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 sm:px-6 py-3 border-b">
          <h2 className="text-lg font-semibold">{t('staffMgmt.upcomingSchedule')}</h2>
        </div>
        {!upcomingSchedules || upcomingSchedules.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            {t('staffMgmt.noUpcomingSchedules')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {tCommon('date')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('schedules.planned')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('schedules.actualStart')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('schedules.actualEnd')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {tCommon('status')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {upcomingSchedules.map((sched) => {
                  const schedStatusColors: Record<string, string> = {
                    scheduled: 'bg-gray-100 text-gray-700',
                    in_progress: 'bg-blue-100 text-blue-700',
                    completed: 'bg-green-100 text-green-700',
                    missed: 'bg-red-100 text-red-700',
                  };
                  return (
                    <tr key={sched.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {new Date(sched.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {sched.planned_start?.slice(0, 5)} - {sched.planned_end?.slice(0, 5)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {sched.actual_start
                          ? new Date(sched.actual_start).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {sched.actual_end
                          ? new Date(sched.actual_end).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            schedStatusColors[sched.status] || schedStatusColors.scheduled
                          }`}
                        >
                          {sched.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showEditModal && (
        <StaffEditModal
          staff={member}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            refetchStaff();
          }}
        />
      )}

      {showResetPasswordModal && (
        <StaffResetPasswordModal
          staffId={member.id}
          staffName={member.full_name}
          onClose={() => setShowResetPasswordModal(false)}
        />
      )}
    </div>
  );
}
