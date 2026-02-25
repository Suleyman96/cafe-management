'use client';

import type { Database } from '@cafe-idare/database';
import { LoadingSpinner } from '@cafe-idare/ui';
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

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { TaskModal } from '@/components/modals/task-modal';
import { Button } from '@/components/ui/button';
import {
  useAuth,
  useDeleteTask,
  useGenerateRecurringTasks,
  useMarkTaskCancelled,
  useMarkTaskCompleted,
  useMarkTaskInProgress,
  useMyTasks,
  useOverdueTasksCount,
  useRecurringTemplates,
  useTasks,
  useTodaysTasks,
} from '@/hooks';

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
  const { staff } = useAuth();
  const isAdmin = staff?.role === 'admin' || staff?.role === 'owner';
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabView) || 'today';
  const [activeTab, setActiveTab] = useState<TabView>(initialTab);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const generateRecurring = useGenerateRecurringTasks();
  const { data: todaysTasks = [], isLoading: todayLoading } = useTodaysTasks();
  const { data: allTasks = [], isLoading: allLoading } = useTasks({
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    isTemplate: false,
  });
  const { data: myTasks = [] } = useMyTasks(staff?.id || '');
  const { data: templates = [] } = useRecurringTemplates();
  const { data: overdueCount = 0 } = useOverdueTasksCount();
  const markInProgress = useMarkTaskInProgress();
  const markCompleted = useMarkTaskCompleted();
  const markCancelled = useMarkTaskCancelled();
  const deleteTask = useDeleteTask();

  // Auto-generate recurring tasks on page load (once)
  const hasGenerated = useRef(false);
  useEffect(() => {
    if (hasGenerated.current) return;
    hasGenerated.current = true;
    const today = new Date().toISOString().split('T')[0];
    generateRecurring.mutate(today);
  }, [generateRecurring]);

  const completedToday = todaysTasks.filter((t: any) => t.status === 'completed').length;
  const openTasks = allTasks.filter(
    (t: any) => t.status === 'pending' || t.status === 'in_progress',
  ).length;

  const handleQuickAction = async (taskId: string, action: 'start' | 'complete' | 'cancel') => {
    try {
      if (action === 'start') {
        await markInProgress.mutateAsync(taskId);
        toast.success('Task started');
      } else if (action === 'complete') {
        await markCompleted.mutateAsync(taskId);
        toast.success('Task completed');
      } else if (action === 'cancel') {
        await markCancelled.mutateAsync(taskId);
        toast.success('Task cancelled');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update task');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteTask.mutateAsync(id);
      toast.success('Task deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    }
  };

  const getDisplayTasks = (): any[] => {
    switch (activeTab) {
      case 'today':
        return todaysTasks;
      case 'all':
        return allTasks;
      case 'my':
        return myTasks;
      case 'templates':
        return templates;
      default:
        return [];
    }
  };

  const isLoading = activeTab === 'today' ? todayLoading : allLoading;
  const displayTasks = getDisplayTasks();

  const isOverdue = (task: any) => {
    if (!task.due_date) return false;
    if (task.status === 'completed' || task.status === 'cancelled') return false;
    return task.due_date < new Date().toISOString().split('T')[0];
  };

  const RECURRENCE_LABELS: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
  };

  const getWeekdayLabels = (days: number[]) => {
    const names = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((d) => names[d] || d).join(', ');
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-500 mt-1">Manage daily operations and staff assignments</p>
        </div>
        <Button onClick={() => setShowTaskModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <ListTodo className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Open Tasks</p>
              <p className="text-2xl font-bold text-gray-900">{openTasks}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Overdue</p>
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
              <p className="text-sm text-gray-500">Completed Today</p>
              <p className="text-2xl font-bold text-gray-900">{completedToday}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {(
          [
            { key: 'today', label: "Today's Tasks" },
            { key: 'all', label: 'All Tasks' },
            { key: 'my', label: 'My Tasks' },
            ...(isAdmin ? [{ key: 'templates', label: 'Recurring Templates' }] : []),
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

      {/* Filters (for all/my tabs) */}
      {(activeTab === 'all' || activeTab === 'my') && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-3">
        {displayTasks.map((task: any) => (
          <div
            key={task.id}
            className={`bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow ${
              isOverdue(task) ? 'border-red-300 bg-red-50' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Status Icon */}
              <div className="mt-0.5">{STATUS_ICONS[task.status] || STATUS_ICONS.pending}</div>

              {/* Content */}
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
                  {/* Priority badge */}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority]}`}
                  >
                    {task.priority}
                  </span>

                  {/* Assignee */}
                  {task.assigned_to_staff?.full_name && (
                    <span className="text-xs text-gray-500">
                      {task.assigned_to_staff.full_name}
                    </span>
                  )}

                  {/* Due date */}
                  {task.due_date && !task.is_recurring && (
                    <span
                      className={`text-xs flex items-center gap-1 ${isOverdue(task) ? 'text-red-600 font-medium' : 'text-gray-500'}`}
                    >
                      <Clock className="h-3 w-3" />
                      {new Date(task.due_date).toLocaleDateString()}
                      {task.due_time && ` ${task.due_time.slice(0, 5)}`}
                    </span>
                  )}

                  {/* Recurrence info (for templates) */}
                  {task.is_recurring && (
                    <span className="text-xs text-blue-600 flex items-center gap-1">
                      <Repeat className="h-3 w-3" />
                      {RECURRENCE_LABELS[task.recurrence_pattern] || task.recurrence_pattern}
                      {task.recurrence_pattern === 'weekly' && task.recurrence_days?.length > 0 && (
                        <span>({getWeekdayLabels(task.recurrence_days)})</span>
                      )}
                      {task.recurrence_pattern === 'monthly' &&
                        task.recurrence_days?.length > 0 && (
                          <span>(Day {task.recurrence_days[0]})</span>
                        )}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {task.status === 'pending' && !task.is_recurring && (
                  <button
                    onClick={() => handleQuickAction(task.id, 'start')}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                    title="Start"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                )}
                {(task.status === 'pending' || task.status === 'in_progress') &&
                  !task.is_recurring && (
                    <button
                      onClick={() => handleQuickAction(task.id, 'complete')}
                      className="p-1.5 text-gray-400 hover:text-green-600 rounded"
                      title="Complete"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  )}
                <button
                  onClick={() => {
                    setEditingTask(task);
                    setShowTaskModal(true);
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {displayTasks.length === 0 && (
          <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
            {activeTab === 'templates'
              ? 'No recurring templates. Create one to auto-generate daily tasks.'
              : 'No tasks found.'}
          </div>
        )}
      </div>

      {/* Task Modal */}
      {showTaskModal && (
        <TaskModal
          task={editingTask || undefined}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}
