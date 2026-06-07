'use client';

import type { Staff } from '@gustri/database/types';
import { useMemo, useState } from 'react';
import { useSchedulesByDateRange, useStaff } from '@/hooks';
import { formatDate, getMonthDates, getWeekDates, type StaffSchedule } from './schedule-utils';

export type ScheduleViewMode = 'weekly' | 'daily' | 'monthly';

/**
 * Controller for the schedules calendar: view mode + week/month navigation,
 * the date-range query, and the three view-specific groupings (by-staff for
 * weekly, by-selected-date for daily, by-date for monthly). Extracted verbatim
 * from SchedulesPage — behavior unchanged.
 */
export function useScheduleCalendar() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [viewMode, setViewMode] = useState<ScheduleViewMode>('weekly');
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [showModal, setShowModal] = useState(false);
  const [editSchedule, setEditSchedule] = useState<StaffSchedule | null>(null);

  const weekDates = useMemo(() => {
    const ref = new Date();
    ref.setDate(ref.getDate() + weekOffset * 7);
    return getWeekDates(ref);
  }, [weekOffset]);

  const monthInfo = useMemo(() => {
    const ref = new Date();
    ref.setMonth(ref.getMonth() + monthOffset);
    return getMonthDates(ref.getFullYear(), ref.getMonth());
  }, [monthOffset]);

  const startDate =
    // getWeekDates always returns 7 dates, so indices 0 and 6 are in-bounds
    viewMode === 'monthly' ? formatDate(monthInfo.firstDay) : formatDate(weekDates[0]!);
  const endDate =
    viewMode === 'monthly' ? formatDate(monthInfo.lastDay) : formatDate(weekDates[6]!);

  const { data: schedules, isLoading, refetch } = useSchedulesByDateRange(startDate, endDate);
  const { data: staffList } = useStaff();

  // Group schedules by staff for weekly view
  const schedulesByStaff = useMemo(() => {
    if (!schedules || !staffList) return {};
    const map: Record<string, { staff: Staff; schedules: Record<string, StaffSchedule[]> }> = {};

    // Initialize with all active staff
    for (const s of staffList.filter((s) => s.is_active)) {
      const entry = { staff: s, schedules: {} as Record<string, StaffSchedule[]> };
      map[s.id] = entry;
      for (const d of weekDates) {
        entry.schedules[formatDate(d)] = [];
      }
    }

    for (const sched of schedules as StaffSchedule[]) {
      const sid = sched.staff_id;
      if (map[sid]) {
        const dateKey = sched.date;
        if (!map[sid].schedules[dateKey]) map[sid].schedules[dateKey] = [];
        map[sid].schedules[dateKey].push(sched);
      }
    }

    return map;
  }, [schedules, staffList, weekDates]);

  // Daily view: filter schedules for selected date
  const dailySchedules = useMemo(() => {
    if (!schedules) return [];
    return schedules.filter((s) => s.date === selectedDate);
  }, [schedules, selectedDate]);

  // Monthly view: group schedules by date
  const monthlyByDate = useMemo(() => {
    if (!schedules) return {};
    const map: Record<string, StaffSchedule[]> = {};
    for (const sched of schedules as StaffSchedule[]) {
      const dateKey = sched.date;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(sched);
    }
    return map;
  }, [schedules]);

  const handleOpenCreate = (defaultDate?: string) => {
    setEditSchedule(null);
    setShowModal(true);
    if (defaultDate) setSelectedDate(defaultDate);
  };

  const handleOpenEdit = (schedule: StaffSchedule) => {
    setEditSchedule(schedule);
    setShowModal(true);
  };

  const handleModalSuccess = () => {
    setShowModal(false);
    setEditSchedule(null);
    refetch();
  };

  const closeModal = () => {
    setShowModal(false);
    setEditSchedule(null);
  };

  return {
    // view + navigation
    viewMode,
    setViewMode,
    weekOffset,
    setWeekOffset,
    monthOffset,
    setMonthOffset,
    weekDates,
    monthInfo,
    selectedDate,
    setSelectedDate,
    // data
    isLoading,
    schedulesByStaff,
    dailySchedules,
    monthlyByDate,
    // modal
    showModal,
    editSchedule,
    handleOpenCreate,
    handleOpenEdit,
    handleModalSuccess,
    closeModal,
  };
}
