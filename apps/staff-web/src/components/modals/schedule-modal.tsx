'use client';

import { DAYS_OF_WEEK, getLocalDateString, TIME_OPTIONS } from '@gustri/core';
import type { StaffSchedule, StaffScheduleInsert } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/modals/confirm-dialog';
import { BaseModal } from '@/components/ui/base-modal';
import { useCreateSchedule, useDeleteSchedule, useStaff, useUpdateSchedule } from '@/hooks';

interface ScheduleModalProps {
  schedule?: StaffSchedule; // Existing schedule for edit mode
  defaultDate?: string; // Pre-fill date for create mode
  onClose: () => void;
  onSuccess: () => void;
}

export function ScheduleModal({ schedule, defaultDate, onClose, onSuccess }: ScheduleModalProps) {
  const { t } = useTranslation('staff');
  const isEdit = !!schedule;
  const { data: staffList } = useStaff();
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();

  const [staffId, setStaffId] = useState(schedule?.staff_id || '');
  const [date, setDate] = useState(schedule?.date || defaultDate || '');
  const [plannedStart, setPlannedStart] = useState(schedule?.planned_start?.slice(0, 5) || '09:00');
  const [plannedEnd, setPlannedEnd] = useState(schedule?.planned_end?.slice(0, 5) || '17:00');
  const [actualStart, setActualStart] = useState('');
  const [actualEnd, setActualEnd] = useState('');
  const [status, setStatus] = useState(schedule?.status || 'scheduled');
  const [notes, setNotes] = useState(schedule?.notes || '');
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isBusy = createSchedule.isPending || updateSchedule.isPending || deleteSchedule.isPending;

  // Bulk create state
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatWeeks, setRepeatWeeks] = useState(1);

  // Sync edit data
  useEffect(() => {
    if (schedule) {
      setStaffId(schedule.staff_id || '');
      setDate(schedule.date || '');
      setPlannedStart(schedule.planned_start?.slice(0, 5) || '09:00');
      setPlannedEnd(schedule.planned_end?.slice(0, 5) || '17:00');
      setStatus(schedule.status || 'scheduled');
      setNotes(schedule.notes || '');

      if (schedule.actual_start) {
        const d = new Date(schedule.actual_start);
        setActualStart(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        );
      }
      if (schedule.actual_end) {
        const d = new Date(schedule.actual_end);
        setActualEnd(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        );
      }
    }
  }, [schedule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (!staffId) {
        setError(t('schedules.selectStaffMember'));
        return;
      }

      if (isEdit) {
        const updateData: Partial<StaffScheduleInsert> = {
          staff_id: staffId,
          date,
          planned_start: plannedStart,
          planned_end: plannedEnd,
          status,
          notes: notes || null,
          ...(actualStart ? { actual_start: new Date(actualStart).toISOString() } : {}),
          ...(actualEnd ? { actual_end: new Date(actualEnd).toISOString() } : {}),
        };

        await updateSchedule.mutateAsync({ id: schedule.id, data: updateData });
        toast.success(t('schedules.scheduleUpdated'));
      } else if (repeatEnabled && repeatDays.length > 0) {
        // Bulk create for multiple days
        const baseDate = new Date(date);
        const promises: Promise<unknown>[] = [];

        for (let week = 0; week < repeatWeeks; week++) {
          for (const dayOfWeek of repeatDays) {
            const targetDate = new Date(baseDate);
            const currentDay = baseDate.getDay();
            let daysUntil = dayOfWeek - currentDay;
            if (daysUntil < 0) daysUntil += 7;
            targetDate.setDate(baseDate.getDate() + daysUntil + week * 7);

            const dateStr = getLocalDateString(targetDate);
            promises.push(
              createSchedule.mutateAsync({
                staff_id: staffId,
                date: dateStr,
                planned_start: plannedStart,
                planned_end: plannedEnd,
                actual_start: null,
                actual_end: null,
                status: 'scheduled',
                notes: notes || null,
              } satisfies StaffScheduleInsert),
            );
          }
        }

        const results = await Promise.allSettled(promises);
        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        const failCount = results.length - successCount;
        if (failCount > 0) {
          toast.warning(
            t('schedules.createdEntriesPartial', { success: successCount, failed: failCount }),
          );
        } else {
          toast.success(t('schedules.createdEntries', { count: successCount }));
        }
      } else {
        await createSchedule.mutateAsync({
          staff_id: staffId,
          date,
          planned_start: plannedStart,
          planned_end: plannedEnd,
          actual_start: null,
          actual_end: null,
          status: 'scheduled',
          notes: notes || null,
        } satisfies StaffScheduleInsert);
        toast.success(t('schedules.scheduleCreated'));
      }

      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('schedules.failedSave');
      setError(message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!schedule?.id) return;
    try {
      await deleteSchedule.mutateAsync(schedule.id);
      toast.success(t('schedules.scheduleDeleted'));
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('schedules.failedDelete');
      setError(message);
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  const toggleRepeatDay = (day: number) => {
    setRepeatDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const activeStaff = staffList?.filter((s) => s.is_active) || [];

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={isEdit ? t('schedules.editSchedule') : t('schedules.addSchedule')}
      as="form"
      onSubmit={handleSubmit}
      footer={
        <>
          {isEdit && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isBusy}
              size="sm"
            >
              {t('delete', { ns: 'common' })}
            </Button>
          )}
          <div className="flex-1" />
          <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button type="submit" disabled={isBusy}>
            {isBusy ? t('saving', { ns: 'common' }) : t('save', { ns: 'common' })}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Staff Select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('schedules.staffMember')}
          </label>
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">{t('schedules.selectStaff')}</option>
            {activeStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.role})
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('date', { ns: 'common' })}
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Planned Times */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('schedules.plannedStart')}
            </label>
            <select
              value={plannedStart}
              onChange={(e) => setPlannedStart(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('schedules.plannedEnd')}
            </label>
            <select
              value={plannedEnd}
              onChange={(e) => setPlannedEnd(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Edit-only fields */}
        {isEdit && (
          <>
            {/* Actual Times */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('schedules.actualStart')}
                </label>
                <input
                  type="datetime-local"
                  value={actualStart}
                  onChange={(e) => setActualStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('schedules.actualEnd')}
                </label>
                <input
                  type="datetime-local"
                  value={actualEnd}
                  onChange={(e) => setActualEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('status', { ns: 'common' })}
              </label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as 'scheduled' | 'in_progress' | 'completed' | 'missed')
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="scheduled">{t('schedules.scheduled')}</option>
                <option value="in_progress">{t('schedules.inProgress')}</option>
                <option value="completed">{t('schedules.completed')}</option>
                <option value="missed">{t('schedules.missed')}</option>
              </select>
            </div>
          </>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('notes', { ns: 'common' })}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            placeholder={t('schedules.optionalNotes')}
          />
        </div>

        {/* Bulk create (create mode only) */}
        {!isEdit && (
          <div className="border-t pt-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={repeatEnabled}
                onChange={(e) => setRepeatEnabled(e.target.checked)}
                className="rounded border-gray-300"
              />
              {t('schedules.repeatMultipleDays')}
            </label>

            {repeatEnabled && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {t('schedules.daysOfWeek')}
                  </label>
                  <div className="flex gap-1">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleRepeatDay(day.value)}
                        className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                          repeatDays.includes(day.value)
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {t('schedules.numberOfWeeks')}
                  </label>
                  <select
                    value={repeatWeeks}
                    onChange={(e) => setRepeatWeeks(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n} {n > 1 ? t('schedules.weeks') : t('schedules.week')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title={t('delete', { ns: 'common' })}
        message={t('schedules.deleteConfirm')}
      />
    </BaseModal>
  );
}
