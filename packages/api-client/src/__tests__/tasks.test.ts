import { describe, expect, it } from 'vitest';
import { createTasksWrapper } from '../wrapper/tasks';
import { createMockContext } from './helpers/mock-supabase';

const validTask = {
  id: '123e4567-e89b-12d3-a456-426614174050',
  title: 'Clean coffee machine',
  description: 'Deep clean the espresso machine',
  category_id: null,
  priority: 'normal',
  status: 'pending',
  assigned_to: '123e4567-e89b-12d3-a456-426614174001',
  created_by: '123e4567-e89b-12d3-a456-426614174002',
  due_date: '2025-02-20',
  due_time: '08:00',
  completed_at: null,
  is_recurring: false,
  recurrence_pattern: null,
  recurrence_days: null,
  parent_task_id: null,
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const completedTask = {
  ...validTask,
  id: '123e4567-e89b-12d3-a456-426614174051',
  status: 'completed',
  completed_at: new Date().toISOString(),
};

describe('TasksWrapper', () => {
  it('findAll returns tasks', async () => {
    const ctx = createMockContext({
      responses: {
        tasks: { data: [validTask], error: null },
      },
    });
    const tasks = createTasksWrapper(ctx);
    const result = await tasks.findAll();
    expect(result).toEqual([validTask]);
  });

  it('findAll with filters', async () => {
    const ctx = createMockContext({
      responses: {
        tasks: { data: [validTask], error: null },
      },
    });
    const tasks = createTasksWrapper(ctx);
    const result = await tasks.findAll({
      status: 'pending',
      priority: 'normal',
      assignedTo: validTask.assigned_to!,
    });
    expect(result).toEqual([validTask]);
  });

  it('findById returns single task', async () => {
    const ctx = createMockContext({
      responses: {
        tasks: { data: validTask, error: null },
      },
    });
    const tasks = createTasksWrapper(ctx);
    const result = await tasks.findById(validTask.id);
    expect(result).toEqual(validTask);
  });

  it('create inserts task with defaults', async () => {
    const ctx = createMockContext({
      responses: {
        tasks: { data: validTask, error: null },
      },
    });
    const tasks = createTasksWrapper(ctx);
    const result = await tasks.create({
      title: 'Clean coffee machine',
      description: 'Deep clean the espresso machine',
      priority: 'normal',
      status: 'pending',
      assigned_to: validTask.assigned_to,
      created_by: validTask.created_by,
      due_date: '2025-02-20',
      due_time: '08:00',
      completed_at: null,
      is_recurring: false,
      recurrence_pattern: null,
      recurrence_days: null,
      parent_task_id: null,
      notes: null,
    });
    expect(result).toEqual(validTask);
    expect(ctx.getCalls()[0].method).toBe('insert');
  });

  it('markCompleted sets completed_at', async () => {
    const ctx = createMockContext({
      responses: {
        tasks: { data: completedTask, error: null },
      },
    });
    const tasks = createTasksWrapper(ctx);
    const result = await tasks.markCompleted(validTask.id);
    expect(result.status).toBe('completed');
    expect(result.completed_at).toBeTruthy();
  });

  it('markInProgress updates status', async () => {
    const inProgressTask = { ...validTask, status: 'in_progress' };
    const ctx = createMockContext({
      responses: {
        tasks: { data: inProgressTask, error: null },
      },
    });
    const tasks = createTasksWrapper(ctx);
    const result = await tasks.markInProgress(validTask.id);
    expect(result.status).toBe('in_progress');
  });

  it('markCancelled updates status', async () => {
    const cancelledTask = { ...validTask, status: 'cancelled' };
    const ctx = createMockContext({
      responses: {
        tasks: { data: cancelledTask, error: null },
      },
    });
    const tasks = createTasksWrapper(ctx);
    const result = await tasks.markCancelled(validTask.id);
    expect(result.status).toBe('cancelled');
  });

  it('findMyTasks filters by assignee', async () => {
    const ctx = createMockContext({
      responses: {
        tasks: { data: [validTask], error: null },
      },
    });
    const tasks = createTasksWrapper(ctx);
    const result = await tasks.findMyTasks(validTask.assigned_to!);
    expect(result).toEqual([validTask]);
  });

  it('getOverdueCount returns count', async () => {
    const overdueTasks = [{ id: '1' }, { id: '2' }];
    const ctx = createMockContext({
      responses: {
        tasks: { data: overdueTasks, error: null },
      },
    });
    const tasks = createTasksWrapper(ctx);
    const result = await tasks.getOverdueCount();
    expect(result).toBe(2);
  });

  it('delete removes task', async () => {
    const ctx = createMockContext({
      responses: {
        tasks: { data: null, error: null },
      },
    });
    const tasks = createTasksWrapper(ctx);
    await tasks.delete(validTask.id);
    expect(ctx.getCalls()[0].method).toBe('delete');
  });

  it('assignTo updates assigned_to', async () => {
    const reassigned = { ...validTask, assigned_to: 'new-staff-id' };
    const ctx = createMockContext({
      responses: {
        tasks: { data: reassigned, error: null },
      },
    });
    const tasks = createTasksWrapper(ctx);
    const result = await tasks.assignTo(validTask.id, 'new-staff-id');
    expect(result.assigned_to).toBe('new-staff-id');
  });

  it('throws on error', async () => {
    const ctx = createMockContext({
      responses: {
        tasks: { data: null, error: { status: 500 } },
      },
    });
    const tasks = createTasksWrapper(ctx);
    await expect(tasks.findAll()).rejects.toThrow();
  });
});
