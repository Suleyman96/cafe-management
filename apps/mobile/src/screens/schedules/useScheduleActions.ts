import type { StaffSchedule, StaffScheduleInsert } from '@gustri/database/types';
import { useTranslation } from '@gustri/i18n';
import { useUpdateSchedule } from '@/hooks/local';
import {
  useCreateSchedule,
  useDeleteSchedule,
  useMarkScheduleCompleted,
  useMarkScheduleInProgress,
} from '@/hooks/shared';
import { useSnackbar } from '@/hooks/use-snackbar';

// The schedules hook joins staff data via Supabase select
type ScheduleWithStaff = StaffSchedule & {
  staff?: { full_name: string; role?: string } | null;
};

type EditScheduleState = {
  id: string;
  staff_id?: string;
  date?: string;
  planned_start?: string;
  planned_end?: string;
  actual_start?: string | null;
  actual_end?: string | null;
  status?: string;
  notes?: string | null;
} | null;

export type ScheduleModalSubmitPayload = {
  id?: string;
  data?: Record<string, string | number | boolean | null>;
  entries?: Record<string, string | number | boolean | null>[];
  mode: 'edit' | 'create' | 'bulk';
};

interface UseScheduleActionsParams {
  schedules: ScheduleWithStaff[] | undefined;
  deleteScheduleId: string | null;
  setShowModal: (visible: boolean) => void;
  setEditSchedule: (schedule: EditScheduleState) => void;
  setDeleteScheduleId: (id: string | null) => void;
}

export function useScheduleActions({
  schedules,
  deleteScheduleId,
  setShowModal,
  setEditSchedule,
  setDeleteScheduleId,
}: UseScheduleActionsParams) {
  const { showSuccess, showError } = useSnackbar();
  const { t } = useTranslation('staff');

  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteScheduleMut = useDeleteSchedule();
  const markInProgress = useMarkScheduleInProgress();
  const markCompleted = useMarkScheduleCompleted();

  const handleMarkInProgress = async (id: string) => {
    try {
      await markInProgress.mutateAsync({ id, actualStart: new Date().toISOString() });
      showSuccess(t('schedules.shiftStarted'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('schedules.failedStartShift'));
    }
  };

  const handleMarkCompleted = async (id: string) => {
    try {
      await markCompleted.mutateAsync({ id, actualEnd: new Date().toISOString() });
      showSuccess(t('schedules.shiftCompleted'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('schedules.failedCompleteShift'));
    }
  };

  const handleEdit = (id: string) => {
    const sched = schedules?.find((s) => s.id === id);
    if (sched) {
      setEditSchedule(sched);
      setShowModal(true);
    }
  };

  const handleModalSubmit = async (payload: ScheduleModalSubmitPayload) => {
    try {
      if (payload.mode === 'edit') {
        await updateSchedule.mutateAsync({ id: payload.id!, data: payload.data! });
        showSuccess(t('schedules.scheduleUpdated'));
      } else if (payload.mode === 'bulk') {
        const results = await Promise.allSettled(
          (payload.entries || []).map((entry) =>
            createSchedule.mutateAsync(entry as unknown as StaffScheduleInsert),
          ),
        );
        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        const failCount = results.length - successCount;
        if (failCount > 0) {
          showError(t('schedules.bulkCreatePartial', { successCount, failCount }));
        } else {
          showSuccess(t('schedules.bulkCreateSuccess', { count: successCount }));
        }
      } else {
        await createSchedule.mutateAsync(payload.data as unknown as StaffScheduleInsert);
        showSuccess(t('schedules.scheduleCreated'));
      }
      setShowModal(false);
      setEditSchedule(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('schedules.failedSave'));
    }
  };

  const handleDeleteSchedule = async () => {
    if (!deleteScheduleId) return;
    try {
      await deleteScheduleMut.mutateAsync(deleteScheduleId);
      showSuccess(t('schedules.scheduleDeleted'));
      setDeleteScheduleId(null);
      setShowModal(false);
      setEditSchedule(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('schedules.failedDelete'));
    }
  };

  return {
    createSchedule,
    updateSchedule,
    handleMarkInProgress,
    handleMarkCompleted,
    handleEdit,
    handleModalSubmit,
    handleDeleteSchedule,
  };
}
