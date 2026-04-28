/**
 * Recurring task expansion engine.
 *
 * Split out from tasks.ts in 2026-04 — the recurrence logic was the bulk of
 * the wrapper file and has its own concerns (date math across timezones,
 * template-vs-instance handling). Kept as an internal helper; the public
 * surface stays on `db.tasks.generateRecurringTasks` / `db.tasks.getRecurringTemplates`.
 */

import { handleSupabaseError } from '../errors';
import type { TaskRow, WrapperContext } from './types';

export async function listRecurringTemplates(ctx: WrapperContext) {
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
}

export async function generateRecurringTaskInstances(
  ctx: WrapperContext,
  date: string,
): Promise<TaskRow[]> {
  const { data: templates, error: fetchError } = await ctx.client
    .from('tasks')
    .select('*')
    .eq('is_recurring', true)
    .is('parent_task_id', null);

  if (fetchError) throw handleSupabaseError(fetchError);
  if (!templates || templates.length === 0) return [];

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
    if (existingParentIds.has(template.id)) continue;

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
}
