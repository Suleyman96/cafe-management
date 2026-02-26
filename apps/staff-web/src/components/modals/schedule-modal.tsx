'use client';

import { useTranslation } from '@cafe-idare/i18n';
import { Button } from '@cafe-idare/ui';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useCreateSchedule, useDeleteSchedule, useStaff, useUpdateSchedule } from '@/hooks';

interface ScheduleModalProps {
  schedule?: any; // Existing schedule for edit mode
  defaultDate?: string; // Pre-fill date for create mode
  onClose: () => void;
  onSuccess: () => void;
}

// Generate 30-minute time slots from 00:00 to 23:30
const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    setLoading(true);

    try {
      if (!staffId) {
        setError(t('schedules.selectStaffMember'));
        setLoading(false);
        return;
      }

      if (isEdit) {
        const updateData: any = {
          staff_id: staffId,
          date,
          planned_start: plannedStart,
          planned_end: plannedEnd,
          status,
          notes: notes || null,
        };

        if (actualStart) {
          updateData.actual_start = new Date(actualStart).toISOString();
        }
        if (actualEnd) {
          updateData.actual_end = new Date(actualEnd).toISOString();
        }

        await updateSchedule.mutateAsync({ id: schedule.id, data: updateData });
        toast.success(t('schedules.scheduleUpdated'));
      } else if (repeatEnabled && repeatDays.length > 0) {
        // Bulk create for multiple days
        const baseDate = new Date(date);
        const promises: Promise<any>[] = [];

        for (let week = 0; week < repeatWeeks; week++) {
          for (const dayOfWeek of repeatDays) {
            const targetDate = new Date(baseDate);
            // Find the next occurrence of this day of week from baseDate + week offset
            const currentDay = baseDate.getDay();
            let daysUntil = dayOfWeek - currentDay;
            if (daysUntil < 0) daysUntil += 7;
            targetDate.setDate(baseDate.getDate() + daysUntil + week * 7);

            const dateStr = targetDate.toISOString().split('T')[0];
            promises.push(
              createSchedule.mutateAsync({
                staff_id: staffId,
                date: dateStr,
                planned_start: plannedStart,
                planned_end: plannedEnd,
                status: 'scheduled',
                notes: notes || null,
              } as any),
            );
          }
        }

        await Promise.allSettled(promises);
        toast.success(t('schedules.createdEntries', { count: promises.length }));
      } else {
        await createSchedule.mutateAsync({
          staff_id: staffId,
          date,
          planned_start: plannedStart,
          planned_end: plannedEnd,
          status: 'scheduled',
          notes: notes || null,
        } as any);
        toast.success(t('schedules.scheduleCreated'));
      }

      onSuccess();
    } catch (err: any) {
      setError(err?.message || t('schedules.failedSave'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!schedule?.id) return;
    if (!confirm(t('schedules.deleteConfirm'))) return;

    setLoading(true);
    try {
      await deleteSchedule.mutateAsync(schedule.id);
      toast.success(t('schedules.scheduleDeleted'));
      onSuccess();
    } catch (err: any) {
      setError(err?.message || t('schedules.failedDelete'));
    } finally {
      setLoading(false);
    }
  };

  const toggleRepeatDay = (day: number) => {
    setRepeatDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const activeStaff = staffList?.filter((s: any) => s.is_active) || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? t('schedules.editSchedule') : t('schedules.addSchedule')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
              {activeStaff.map((s: any) => (
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
                  onChange={(e) => setStatus(e.target.value)}
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
                          {n} week{n > 1 ? 's' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                size="sm"
              >
                {t('delete', { ns: 'common' })}
              </Button>
            )}
            <div className="flex-1" />
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('saving', { ns: 'common' }) : t('save', { ns: 'common' })}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
