/**
 * Tasks wrapper module
 */

import { getLocalDateString, handleSupabaseError, isTask } from '@gustri/core';
import type { TaskInsert, TaskRow, TaskUpdate, WrapperContext } from './types';

export function createTasksWrapper(ctx: WrapperContext) {
  return {
    findAll: async (options?: {
      status?: string;
      priority?: string;
      assignedTo?: string;
      dueBefore?: string;
      isTemplate?: boolean;
      limit?: number;
      offset?: number;
    }) => {
      let query = ctx.client
        .from('tasks')
        .select(`
          *,
          assigned_to_staff:staff!tasks_assigned_to_fkey(full_name),
          created_by_staff:staff!tasks_created_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

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
      const { data, error } = await ctx.client
        .from('tasks')
        .select(`
          *,
          assigned_to_staff:staff!tasks_assigned_to_fkey(full_name),
          created_by_staff:staff!tasks_created_by_fkey(full_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isTask(data)) throw new Error('Invalid task data');
      return data as TaskRow;
    },

    findMyTasks: async (staffId: string) => {
      const { data, error } = await ctx.client
        .from('tasks')
        .select(`
          *,
          assigned_to_staff:staff!tasks_assigned_to_fkey(full_name),
          created_by_staff:staff!tasks_created_by_fkey(full_name)
        `)
        .eq('assigned_to', staffId)
        .eq('is_recurring', false)
        .order('due_date', { ascending: true });

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    getTodaysTasks: async () => {
      const today = getLocalDateString();
      const { data, error } = await ctx.client
        .from('tasks')
        .select(`
          *,
          assigned_to_staff:staff!tasks_assigned_to_fkey(full_name),
          created_by_staff:staff!tasks_created_by_fkey(full_name)
        `)
        .eq('due_date', today)
        .eq('is_recurring', false)
        .order('due_time', { ascending: true });

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    getOverdueCount: async () => {
      const today = getLocalDateString();
      const { data, error } = await ctx.client
        .from('tasks')
        .select('id')
        .lt('due_date', today)
        .in('status', ['pending', 'in_progress'])
        .eq('is_recurring', false);

      if (error) throw handleSupabaseError(error);
      return (data || []).length;
    },

    getOpenTasksCount: async () => {
      const { data, error } = await ctx.client
        .from('tasks')
        .select('id')
        .in('status', ['pending', 'in_progress'])
        .eq('is_recurring', false);

      if (error) throw handleSupabaseError(error);
      return (data || []).length;
    },

    getRecurringTemplates: async () => {
      const { data, error } = await ctx.client
        .from('tasks')
        .select(`
          *,
          assigned_to_staff:staff!tasks_assigned_to_fkey(full_name)
        `)
        .eq('is_recurring', true)
        .is('parent_task_id', null)
        .order('title');

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    create: async (data: TaskInsert) => {
      const { data: result, error } = await ctx.anyClient
        .from('tasks')
        .insert(data)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
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

    generateRecurringTasks: async (date: string) => {
      // Fetch all active recurring templates
      const { data: templates, error: fetchError } = await ctx.client
        .from('tasks')
        .select('*')
        .eq('is_recurring', true)
        .is('parent_task_id', null);

      if (fetchError) throw handleSupabaseError(fetchError);
      if (!templates || templates.length === 0) return [];

      // Check which templates already have instances for this date
      const templateIds = (templates as TaskRow[]).map((t) => t.id);
      const { data: existing, error: existError } = await ctx.client
        .from('tasks')
        .select('parent_task_id')
        .in('parent_task_id', templateIds)
        .eq('due_date', date);

      if (existError) throw handleSupabaseError(existError);

      const existingParentIds = new Set(
        ((existing || []) as Pick<TaskRow, 'parent_task_id'>[]).map((e) => e.parent_task_id),
      );

      // Parse date string directly to avoid UTC vs local timezone issues.
      // new Date("YYYY-MM-DD") parses as UTC midnight, then getDate()/getDay()
      // use local timezone which can return the wrong day in negative UTC offsets.
      const [year, month, day] = date.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day); // local midnight
      const dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay(); // 1=Mon, 7=Sun
      const dayOfMonth = day;

      const created: TaskRow[] = [];

      for (const template of templates as TaskRow[]) {
        // Skip if already generated for this date
        if (existingParentIds.has(template.id)) continue;

        // Check if date matches recurrence pattern
        let shouldGenerate = false;

        if (template.recurrence_pattern === 'daily') {
          shouldGenerate = true;
        } else if (template.recurrence_pattern === 'weekly') {
          shouldGenerate = (template.recurrence_days || []).includes(dayOfWeek);
        } else if (template.recurrence_pattern === 'monthly') {
          shouldGenerate = (template.recurrence_days || []).includes(dayOfMonth);
        }

        if (!shouldGenerate) continue;

        const { data: newTask, error: createError } = await ctx.anyClient
          .from('tasks')
          .insert({
            title: template.title,
            description: template.description,
            priority: template.priority,
            status: 'pending',
            assigned_to: template.assigned_to,
            created_by: template.created_by,
            due_date: date,
            due_time: template.due_time,
            is_recurring: false,
            parent_task_id: template.id,
            notes: template.notes,
          })
          .select()
          .single();

        if (createError) throw handleSupabaseError(createError);
        if (newTask) created.push(newTask as TaskRow);
      }

      return created;
    },
  };
}

export type TasksWrapper = ReturnType<typeof createTasksWrapper>;
