'use client';

import { getLocalDateString } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { LoadingSpinner } from '@gustri/ui-web';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { StaffEditModal } from '@/components/modals/staff-edit-modal';
import { StaffResetPasswordModal } from '@/components/modals/staff-reset-password-modal';
import { StaffHoursWorked } from '@/components/staff/staff-hours-worked';
import { StaffPerformanceStats } from '@/components/staff/staff-performance-stats';
import { StaffProfileCard } from '@/components/staff/staff-profile-card';
import { StaffRecentOrders } from '@/components/staff/staff-recent-orders';
import { StaffRecentPayments } from '@/components/staff/staff-recent-payments';
import { StaffUpcomingSchedule } from '@/components/staff/staff-upcoming-schedule';
import { calculateHoursWorked, useStaffStats } from '@/components/staff/use-staff-stats';
import { useMySchedule, useOrders, usePaymentsByStaff, useStaffMember } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { useFormatPrice } from '@/hooks/use-format-price';

export default function StaffDetailPage() {
  const params = useParams();
  const staffId = params.id as string;
  const { staff: currentUser } = useAuth();
  const { t } = useTranslation('staff');

  const {
    data: staffMember,
    isLoading: staffLoading,
    refetch: refetchStaff,
  } = useStaffMember(staffId);
  // Bounded fetch — the staff detail page only renders the most recent orders
  // assigned to or relevant to this staff member.
  const { data: allOrders, isLoading: ordersLoading } = useOrders({ limit: 200 });
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
  const { stats, recentOrders } = useStaffStats(allOrders, staffId);

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

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Back button */}
      <Link
        href="/staff"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('staffMgmt.backToTitle')}
      </Link>

      {/* Profile Card */}
      <StaffProfileCard
        member={member}
        onEdit={() => setShowEditModal(true)}
        onResetPassword={() => setShowResetPasswordModal(true)}
      />

      {/* Performance Stats */}
      {!ordersLoading && stats && <StaffPerformanceStats stats={stats} formatPrice={formatPrice} />}

      {/* Recent Orders */}
      <StaffRecentOrders
        recentOrders={recentOrders}
        ordersLoading={ordersLoading}
        formatPrice={formatPrice}
      />

      {/* Recent Payments */}
      <StaffRecentPayments
        recentPayments={recentPayments}
        paymentsLoading={paymentsLoading}
        formatPrice={formatPrice}
      />

      {/* Hours Worked */}
      <StaffHoursWorked weeklyHours={weeklyHours} monthlyHours={monthlyHours} />

      {/* Upcoming Schedule */}
      <StaffUpcomingSchedule upcomingSchedules={upcomingSchedules} />

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
