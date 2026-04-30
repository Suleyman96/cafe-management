'use client';

import { getLocalDateString, TIME_OPTIONS, WEEKDAYS } from '@gustri/core';
import type { Database, TaskInsert } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import { NumberInput } from '@gustri/ui-web';
import { useState } from 'react';
import { toast } from 'sonner';
import { BaseModal } from '@/components/ui/base-modal';
import { useAuth, useCreateTask, useStaff, useUpdateTask } from '@/hooks';

type Task = Database['public']['Tables']['tasks']['Row'];

interface TaskModalProps {
  task?: Task;
  onClose: () => void;
}

const PRIORITIES = [
  { value: 'low' as const, color: 'bg-gray-100 text-gray-700' },
  { value: 'normal' as const, color: 'bg-blue-100 text-blue-700' },
  { value: 'high' as const, color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent' as const, color: 'bg-red-100 text-red-700' },
];

export function TaskModal({ task, onClose }: TaskModalProps) {
  const { t } = useTranslation('staff');

  const WEEKDAY_KEYS = [
    '',
    'weekdays.mon',
    'weekdays.tue',
    'weekdays.wed',
    'weekdays.thu',
    'weekdays.fri',
    'weekdays.sat',
    'weekdays.sun',
  ];
  const isEditing = !!task;
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const { data: staffList = [], isLoading: staffLoading } = useStaff();
  const { staff } = useAuth();
  const isAdmin = staff?.role === 'admin' || staff?.role === 'owner';

  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    priority: task?.priority || 'normal',
    assigned_to: task?.assigned_to || '',
    due_date: task?.due_date || (task?.is_recurring ? '' : getLocalDateString()),
    due_time: task?.due_time?.slice(0, 5) || '',
    is_recurring: task?.is_recurring || false,
    recurrence_pattern: task?.recurrence_pattern || 'daily',
    recurrence_days: task?.recurrence_days || [],
  });

  const toggleWeekday = (day: number) => {
    const days = formData.recurrence_days.includes(day)
      ? formData.recurrence_days.filter((d) => d !== day)
      : [...formData.recurrence_days, day];
    setFormData({ ...formData, recurrence_days: days });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error(t('tasks.titleRequired'));
      return;
    }

    const toastId = toast.loading(isEditing ? t('tasks.updatingTask') : t('tasks.creatingTask'));

    try {
      const base = {
        title: formData.title.trim(),
        description: formData.description || null,
        priority: formData.priority as TaskInsert['priority'],
        assigned_to: formData.assigned_to || null,
        notes: null as string | null,
        category_id: null as string | null,
        completed_at: null as string | null,
        parent_task_id: null as string | null,
      };

      if (isEditing) {
        const updates = formData.is_recurring
          ? {
              ...base,
              is_recurring: true,
              recurrence_pattern: formData.recurrence_pattern,
              recurrence_days:
                formData.recurrence_pattern === 'weekly' ||
                formData.recurrence_pattern === 'monthly'
                  ? formData.recurrence_days
                  : [],
              due_time: formData.due_time || null,
            }
          : {
              ...base,
              is_recurring: false,
              due_date: formData.due_date || null,
              due_time: formData.due_time || null,
            };
        await updateTask.mutateAsync({ id: task.id, updates });
        toast.success(t('tasks.taskUpdated'), { id: toastId });
      } else {
        const createData: TaskInsert = formData.is_recurring
          ? {
              ...base,
              created_by: staff?.id || null,
              status: 'pending',
              is_recurring: true,
              recurrence_pattern: formData.recurrence_pattern,
              recurrence_days:
                formData.recurrence_pattern === 'weekly' ||
                formData.recurrence_pattern === 'monthly'
                  ? formData.recurrence_days
                  : [],
              due_date: null,
              due_time: formData.due_time || null,
            }
          : {
              ...base,
              created_by: staff?.id || null,
              status: 'pending',
              is_recurring: false,
              recurrence_pattern: null,
              recurrence_days: null,
              due_date: formData.due_date || null,
              due_time: formData.due_time || null,
            };
        await createTask.mutateAsync(createData);
        toast.success(t('tasks.taskCreated'), { id: toastId });
      }

      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('tasks.failedSave');
      toast.error(message, { id: toastId });
    }
  };

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={isEditing ? t('tasks.editTask') : t('tasks.newTask')}
      as="form"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button type="submit" className="flex-1">
            {isEditing ? t('tasks.update') : t('tasks.newTask')}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('tasks.taskTitle')} *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder={t('tasks.whatNeedsDone')}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('description', { ns: 'common' })}
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder={t('tasks.optionalDescription')}
          />
        </div>

        {/* Assign To */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('tasks.assignTo')}
          </label>
          <select
            value={formData.assigned_to}
            onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('tasks.unassigned')}</option>
            {staffLoading ? (
              <option disabled>{t('loading', { ns: 'common' })}...</option>
            ) : (
              staffList
                .filter((s) => s.is_active !== false)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.role})
                  </option>
                ))
            )}
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('tasks.priority')}
          </label>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setFormData({ ...formData, priority: p.value })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  formData.priority === p.value
                    ? `${p.color} ring-2 ring-offset-1 ring-blue-400`
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {t(`tasks.${p.value}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Due Date + Time (non-recurring only) */}
        {!formData.is_recurring && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('tasks.dueDate')}
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('tasks.dueTime')}
              </label>
              <select
                value={formData.due_time}
                onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('tasks.noTime')}</option>
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Recurring toggle (admin only) */}
        {isAdmin && (
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_recurring"
              checked={formData.is_recurring}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  is_recurring: e.target.checked,
                  due_date: e.target.checked ? '' : formData.due_date || getLocalDateString(),
                })
              }
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor="is_recurring" className="text-sm font-medium text-gray-700">
              {t('tasks.makeRecurring')}
            </label>
          </div>
        )}

        {/* Recurring settings */}
        {formData.is_recurring && isAdmin && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-blue-800">{t('tasks.recurrenceSettings')}</p>

            {/* Pattern */}
            <div className="flex gap-2">
              {(['daily', 'weekly', 'monthly'] as const).map((pattern) => (
                <button
                  key={pattern}
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, recurrence_pattern: pattern, recurrence_days: [] })
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.recurrence_pattern === pattern
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {t(`tasks.${pattern}`)}
                </button>
              ))}
            </div>

            {/* Weekly: day checkboxes */}
            {formData.recurrence_pattern === 'weekly' && (
              <div>
                <label className="block text-sm text-blue-700 mb-2">{t('tasks.whichDays')}</label>
                <div className="flex gap-1">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWeekday(day.value)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        formData.recurrence_days.includes(day.value)
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {t(WEEKDAY_KEYS[day.value])}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly: day of month */}
            {formData.recurrence_pattern === 'monthly' && (
              <div>
                <label className="block text-sm text-blue-700 mb-2">{t('tasks.dayOfMonth')}</label>
                <NumberInput
                  value={formData.recurrence_days[0] || ''}
                  onChange={(v) =>
                    setFormData({
                      ...formData,
                      recurrence_days: [Number.parseInt(v, 10)],
                    })
                  }
                  min={1}
                  max={31}
                  integer
                  placeholder="1"
                  className="w-20"
                />
              </div>
            )}

            {/* Default due time */}
            <div>
              <label className="block text-sm text-blue-700 mb-2">
                {t('tasks.defaultDueTime')}
              </label>
              <select
                value={formData.due_time}
                onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('tasks.noTime')}</option>
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  );
}
