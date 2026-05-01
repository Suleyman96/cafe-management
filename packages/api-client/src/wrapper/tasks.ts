/**
 * Tasks wrapper module
 */

import { getLocalDateString, isTask } from '@gustri/core';
import { handleSupabaseError } from '../errors';
import { dedupeInsert } from './_dedupe';
import { applyTenantScope, assertInsertTenantMatches } from './_tenant-scope';
import { generateRecurringTaskInstances, listRecurringTemplates } from './task-recurrence';
import type { TaskInsert, TaskRow, TaskUpdate, WrapperContext } from './types';

export type TaskScope = 'all' | 'today' | 'mine';

export function createTasksWrapper(ctx: WrapperContext) {
  return {
    /**
     * List tasks with optional filters.
     *
     * `scope` (M12) replaces the previous client-side fan-out where the
     * tasks screen called useTasks + useTodaysTasks + useMyTasks in
     * parallel and then filtered in memory:
     *   - 'all' — no extra filter (the default)
     *   - 'today' — `due_date = current local date`
     *   - 'mine' — `assigned_to = staffId` (requires `staffId`)
     */
    findAll: async (options?: {
      status?: NonNullable<TaskRow['status']>;
      priority?: NonNullable<TaskRow['priority']>;
      assignedTo?: string;
      dueBefore?: string;
      isTemplate?: boolean;
      limit?: number;
      offset?: number;
      scope?: TaskScope;
      staffId?: string;
    }) => {
      let query = applyTenantScope(
        ctx.client
          .from('tasks')
          .select(`
            *,
            assigned_to_staff:staff!tasks_assigned_to_fkey(full_name),
            created_by_staff:staff!tasks_created_by_fkey(full_name)
          `)
          .order('created_at', { ascending: false }),
        ctx,
      );

      if (options?.status) {
        query = query.eq('status', options.status);
      }
      if (options?.priority) {
        query = query.eq('priority', options.priority);
      }
      if (options?.assignedTo) {
        query = query.eq('assigned_to', options.assignedTo);
      }
      if (options?.dueBefore) {
        query = query.lte('due_date', options.dueBefore);
      }
      if (options?.isTemplate !== undefined) {
        if (options.isTemplate) {
          query = query.eq('is_recurring', true).is('parent_task_id', null);
        } else {
          query = query.eq('is_recurring', false);
        }
      }

      const scope = options?.scope ?? 'all';
      if (scope === 'today') {
        query = query.eq('due_date', getLocalDateString());
      } else if (scope === 'mine') {
        if (!options?.staffId) {
          throw new Error('tasks.findAll: scope=mine requires staffId');
        }
        query = query.eq('assigned_to', options.staffId);
      }

      // Apply pagination with sensible defaults
      const limit = options?.limit ?? 200;
      const offset = options?.offset ?? 0;
      if (limit > 0) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findById: async (id: string) => {
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('tasks')
          .select(`
            *,
            assigned_to_staff:staff!tasks_assigned_to_fkey(full_name),
            created_by_staff:staff!tasks_created_by_fkey(full_name)
          `)
          .eq('id', id),
        ctx,
      ).single();

      if (error) throw handleSupabaseError(error);
      if (!isTask(data)) throw new Error('Invalid task data');
      return data as TaskRow;
    },

    findMyTasks: async (staffId: string) => {
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('tasks')
          .select(`
            *,
            assigned_to_staff:staff!tasks_assigned_to_fkey(full_name),
            created_by_staff:staff!tasks_created_by_fkey(full_name)
          `)
          .eq('assigned_to', staffId)
          .eq('is_recurring', false)
          .order('due_date', { ascending: true }),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    getTodaysTasks: async () => {
      const today = getLocalDateString();
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('tasks')
          .select(`
            *,
            assigned_to_staff:staff!tasks_assigned_to_fkey(full_name),
            created_by_staff:staff!tasks_created_by_fkey(full_name)
          `)
          .eq('due_date', today)
          .eq('is_recurring', false)
          .order('due_time', { ascending: true }),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    getOverdueCount: async () => {
      const today = getLocalDateString();
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('tasks')
          .select('id')
          .lt('due_date', today)
          .in('status', ['pending', 'in_progress'])
          .eq('is_recurring', false),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return (data || []).length;
    },

    getOpenTasksCount: async () => {
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('tasks')
          .select('id')
          .in('status', ['pending', 'in_progress'])
          .eq('is_recurring', false),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return (data || []).length;
    },

    /**
     * List all active recurring task templates (rows where
     * `is_recurring = true` and `parent_task_id IS NULL`). Templates
     * themselves are not assignable work — they are blueprints used by
     * `generateRecurringTasks` to materialize daily instances.
     */
    getRecurringTemplates: () => listRecurringTemplates(ctx),

    create: async (data: TaskInsert) => {
      assertInsertTenantMatches(data, ctx);
      const result = await dedupeInsert<unknown>(data.client_request_id, {
        insert: () => ctx.anyClient.from('tasks').insert(data).select().single(),
        refetch: () =>
          applyTenantScope(
            ctx.anyClient
              .from('tasks')
              .select()
              .eq('client_request_id', data.client_request_id ?? ''),
            ctx,
          ).single(),
      });

      if (!isTask(result)) throw new Error('Invalid task data');
      return result as TaskRow;
    },

    update: async (id: string, updates: Partial<TaskUpdate>) => {
      const { data, error } = await ctx.anyClient
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isTask(data)) throw new Error('Invalid task data');
      return data as TaskRow;
    },

    delete: async (id: string) => {
      const { error } = await ctx.anyClient.from('tasks').delete().eq('id', id);

      if (error) throw handleSupabaseError(error);
    },

    markInProgress: async (id: string) => {
      const { data, error } = await ctx.anyClient
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      return data as TaskRow;
    },

    markCompleted: async (id: string) => {
      const { data, error } = await ctx.anyClient
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      return data as TaskRow;
    },

    markCancelled: async (id: string) => {
      const { data, error } = await ctx.anyClient
        .from('tasks')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      return data as TaskRow;
    },

    assignTo: async (id: string, staffId: string) => {
      const { data, error } = await ctx.anyClient
        .from('tasks')
        .update({ assigned_to: staffId })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      return data as TaskRow;
    },

    /**
     * Materialize task instances for the given `date` (YYYY-MM-DD) from
     * every active recurring template whose pattern matches. Idempotent —
     * skips any template that already has an instance for that date.
     *
     * Day-of-week math is computed in *local* time (deliberately): parsing
     * `new Date('YYYY-MM-DD')` returns UTC midnight, which can drift to
     * the previous day in negative-UTC offsets. See `task-recurrence.ts`.
     *
     * Typically called on app boot from `useGenerateRecurringTasks` so
     * staff see today's recurring tasks without a manual trigger.
     */
    generateRecurringTasks: (date: string) => generateRecurringTaskInstances(ctx, date),
  };
}

export type TasksWrapper = ReturnType<typeof createTasksWrapper>;
