'use client';

import { getLocalDateString } from '@gustri/core';
import type { Database } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { Button, LoadingSpinner } from '@gustri/ui';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  ListTodo,
  Pencil,
  Play,
  Plus,
  Repeat,
  Trash2,
  X,
} from 'lucide-react';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/modals/confirm-dialog';
import { TaskModal } from '@/components/modals/task-modal';
import {
  useAuth,
  useDeleteTask,
  useGenerateRecurringTasks,
  useMarkTaskCancelled,
  useMarkTaskCompleted,
  useMarkTaskInProgress,
  useMyTasks,
  useOpenTasksCount,
  useOverdueTasksCount,
  useRecurringTemplates,
  useTasks,
  useTodaysTasks,
} from '@/hooks';
import { useCanPerform } from '@/hooks/use-can-perform';

type Task = Database['public']['Tables']['tasks']['Row'];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-gray-400" />,
  in_progress: <Play className="h-4 w-4 text-blue-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  cancelled: <X className="h-4 w-4 text-gray-400" />,
};

type TabView = 'today' | 'all' | 'my' | 'templates';

export default function TasksPage() {
  const { t } = useTranslation('staff');
  const { staff } = useAuth();
  const isAdmin = useCanPerform('manage_tasks');
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabView) || 'today';

  const setActiveTab = (tab: TabView) => {
    router.replace(`/tasks${tab === 'today' ? '' : `?tab=${tab}`}`);
  };
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<Task | null>(null);

  const generateRecurring = useGenerateRecurringTasks();
  const { data: todaysTasks = [], isLoading: todayLoading } = useTodaysTasks();
  const { data: allTasks = [], isLoading: allLoading } = useTasks({
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    isTemplate: false,
  });
  const { data: myTasks = [], isLoading: myLoading } = useMyTasks(staff?.id || '');
  const { data: templates = [], isLoading: templatesLoading } = useRecurringTemplates();
  const { data: overdueCount = 0 } = useOverdueTasksCount();
  const { data: openTasksCount = 0 } = useOpenTasksCount();
  const markInProgress = useMarkTaskInProgress();
  const markCompleted = useMarkTaskCompleted();
  const markCancelled = useMarkTaskCancelled();
  const deleteTask = useDeleteTask();

  const hasGenerated = useRef(false);
  useEffect(() => {
    if (hasGenerated.current) return;
    hasGenerated.current = true;
    const today = getLocalDateString();
    generateRecurring.mutate(today);
  }, [generateRecurring]);

  const completedToday = todaysTasks.filter((task) => task.status === 'completed').length;

  const handleQuickAction = async (taskId: string, action: 'start' | 'complete' | 'cancel') => {
    try {
      if (action === 'start') {
        await markInProgress.mutateAsync(taskId);
        toast.success(t('tasks.taskStarted'));
      } else if (action === 'complete') {
        await markCompleted.mutateAsync(taskId);
        toast.success(t('tasks.taskCompleted'));
      } else if (action === 'cancel') {
        await markCancelled.mutateAsync(taskId);
        toast.success(t('tasks.taskCancelled'));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('tasks.failedUpdateTask');
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmTask) return;
    try {
      await deleteTask.mutateAsync(deleteConfirmTask.id);
      toast.success(t('tasks.taskDeleted'));
      setDeleteConfirmTask(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('tasks.failedUpdateTask');
      toast.error(message);
    }
  };

  const isLoading =
    activeTab === 'today'
      ? todayLoading
      : activeTab === 'all'
        ? allLoading
        : activeTab === 'my'
          ? myLoading
          : templatesLoading;

  const displayTasks = useMemo(() => {
    switch (activeTab) {
      case 'today':
        return todaysTasks;
      case 'all':
        return allTasks;
      case 'my': {
        let filtered = myTasks;
        if (statusFilter) {
          filtered = filtered.filter((task) => task.status === statusFilter);
        }
        if (priorityFilter) {
          filtered = filtered.filter((task) => task.priority === priorityFilter);
        }
        return filtered;
      }
      case 'templates':
        return templates;
      default:
        return [];
    }
  }, [activeTab, todaysTasks, allTasks, myTasks, templates, statusFilter, priorityFilter]);

  const isOverdue = (task: Task) => {
    if (!task.due_date) return false;
    if (task.status === 'completed' || task.status === 'cancelled') return false;
    return task.due_date < getLocalDateString();
  };

  const RECURRENCE_LABELS: Record<string, string> = {
    daily: t('tasks.daily'),
    weekly: t('tasks.weekly'),
    monthly: t('tasks.monthly'),
  };

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
  const getWeekdayLabels = (days: number[]) => {
    return days.map((d) => t(WEEKDAY_KEYS[d])).join(', ');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('tasks.title')}</h1>
          <p className="text-gray-500 mt-1">{t('tasks.subtitle')}</p>
        </div>
        <Button onClick={() => setShowTaskModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('tasks.newTask')}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <ListTodo className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('tasks.openTasks')}</p>
              <p className="text-2xl font-bold text-gray-900">{openTasksCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('tasks.overdue')}</p>
              <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('tasks.completedToday')}</p>
              <p className="text-2xl font-bold text-gray-900">{completedToday}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b">
        {(
          [
            { key: 'today', label: t('tasks.todayTasks') },
            { key: 'all', label: t('tasks.allTasks') },
            { key: 'my', label: t('tasks.myTasks') },
            ...(isAdmin ? [{ key: 'templates', label: t('tasks.recurringTemplates') }] : []),
          ] as { key: TabView; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(activeTab === 'all' || activeTab === 'my') && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('tasks.allStatuses')}</option>
            <option value="pending">{t('pending', { ns: 'common' })}</option>
            <option value="in_progress">{t('tasks.inProgress')}</option>
            <option value="completed">{t('completed', { ns: 'common' })}</option>
            <option value="cancelled">{t('tasks.cancelled')}</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('tasks.allPriorities')}</option>
            <option value="low">{t('tasks.low')}</option>
            <option value="normal">{t('tasks.normal')}</option>
            <option value="high">{t('tasks.high')}</option>
            <option value="urgent">{t('tasks.urgent')}</option>
          </select>
        </div>
      )}

      <div className="space-y-3">
        {displayTasks.map(
          (
            task: (typeof displayTasks)[number] & {
              assigned_to_staff?: { full_name: string } | null;
            },
          ) => (
            <div
              key={task.id}
              className={`bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow ${
                isOverdue(task) ? 'border-red-300 bg-red-50' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {(task.status && STATUS_ICONS[task.status]) || STATUS_ICONS.pending}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-gray-900">{task.title}</h3>
                    {task.parent_task_id && (
                      <span title="Recurring">
                        <Repeat className="h-3.5 w-3.5 text-blue-400" />
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{task.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${task.priority ? PRIORITY_COLORS[task.priority] : PRIORITY_COLORS.normal}`}
                    >
                      {t(`tasks.${task.priority ?? 'normal'}`)}
                    </span>
                    {task.assigned_to_staff?.full_name && (
                      <span className="text-xs text-gray-500">
                        {task.assigned_to_staff.full_name}
                      </span>
                    )}
                    {task.due_date && !task.is_recurring && (
                      <span
                        className={`text-xs flex items-center gap-1 ${isOverdue(task) ? 'text-red-600 font-medium' : 'text-gray-500'}`}
                      >
                        <Clock className="h-3 w-3" />
                        {new Date(task.due_date).toLocaleDateString()}
                        {task.due_time && ` ${task.due_time.slice(0, 5)}`}
                      </span>
                    )}
                    {task.is_recurring && (
                      <span className="text-xs text-blue-600 flex items-center gap-1">
                        <Repeat className="h-3 w-3" />
                        {(task.recurrence_pattern && RECURRENCE_LABELS[task.recurrence_pattern]) ||
                          task.recurrence_pattern}
                        {task.recurrence_pattern === 'weekly' &&
                          (task.recurrence_days?.length ?? 0) > 0 && (
                            <span>({getWeekdayLabels(task.recurrence_days ?? [])})</span>
                          )}
                        {task.recurrence_pattern === 'monthly' &&
                          (task.recurrence_days?.length ?? 0) > 0 && (
                            <span>
                              ({t('reports.day')} {task.recurrence_days?.[0]})
                            </span>
                          )}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {task.status === 'pending' && !task.is_recurring && (
                    <button
                      type="button"
                      onClick={() => handleQuickAction(task.id, 'start')}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                      title={t('start', { ns: 'common' })}
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                  {(task.status === 'pending' || task.status === 'in_progress') &&
                    !task.is_recurring && (
                      <button
                        type="button"
                        onClick={() => handleQuickAction(task.id, 'complete')}
                        className="p-1.5 text-gray-400 hover:text-green-600 rounded"
                        title={t('complete', { ns: 'common' })}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTask(task);
                      setShowTaskModal(true);
                    }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                    title={t('edit', { ns: 'common' })}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmTask(task)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                      title={t('delete', { ns: 'common' })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ),
        )}

        {displayTasks.length === 0 && (
          <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
            {activeTab === 'templates' ? t('tasks.noTemplates') : t('tasks.noTasks')}
          </div>
        )}
      </div>

      {showTaskModal && (
        <TaskModal
          task={editingTask || undefined}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteConfirmTask}
        onClose={() => setDeleteConfirmTask(null)}
        onConfirm={handleDelete}
        title={t('tasks.deleteTask')}
        message={t('tasks.deleteTaskConfirm')}
        loading={deleteTask.isPending}
      />
    </div>
  );
}
