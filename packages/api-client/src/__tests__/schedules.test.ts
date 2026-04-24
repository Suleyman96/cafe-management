import { ConflictError } from '@gustri/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSchedulesWrapper } from '../wrapper/schedules';
import {
  buildSchedule,
  buildScheduleInsert,
  buildScheduleUpdate,
  resetFactoryCounter,
} from './helpers/factories';
import { createMockContext } from './helpers/mock-supabase';

const validSchedule = buildSchedule({
  id: '123e4567-e89b-12d3-a456-426614174000',
  staff_id: '123e4567-e89b-12d3-a456-426614174001',
  date: '2025-02-23',
  planned_start: '09:00:00',
  planned_end: '17:00:00',
  actual_start: null,
  actual_end: null,
  status: 'scheduled',
  notes: null,
});

// Enriched version with staff join data (as returned by the wrapper)
const validScheduleWithStaff = {
  ...validSchedule,
  staff: { id: '123e4567-e89b-12d3-a456-426614174001', full_name: 'John Doe', role: 'waiter' },
};

describe('SchedulesWrapper', () => {
  beforeEach(() => {
    resetFactoryCounter();
  });

  it('create inserts schedule data', async () => {
    const ctx = createMockContext({
      responses: {
        staff_schedules: { data: validScheduleWithStaff, error: null },
      },
    });
    const schedules = createSchedulesWrapper(ctx);
    const result = await schedules.create(
      buildScheduleInsert({
        staff_id: validSchedule.staff_id,
        date: validSchedule.date,
        planned_start: '09:00',
        planned_end: '17:00',
        status: 'scheduled',
      }),
    );
    expect(result).toEqual(validScheduleWithStaff);
    expect(ctx.getCalls()[0].method).toBe('insert');
  });

  it('update modifies schedule fields', async () => {
    const updated = { ...validScheduleWithStaff, planned_start: '10:00:00' };
    const ctx = createMockContext({
      responses: {
        staff_schedules: { data: updated, error: null },
      },
    });
    const schedules = createSchedulesWrapper(ctx);
    const result = await schedules.update(
      validSchedule.id,
      buildScheduleUpdate({ planned_start: '10:00' }),
    );
    expect(result).toEqual(updated);
    expect(ctx.getCalls()[0].method).toBe('update');
  });

  it('delete removes schedule', async () => {
    const ctx = createMockContext({
      responses: {
        staff_schedules: { data: null, error: null },
      },
    });
    const schedules = createSchedulesWrapper(ctx);
    await schedules.delete(validSchedule.id);
    expect(ctx.getCalls()[0].method).toBe('delete');
  });

  it('findByDate returns schedules for a date', async () => {
    const ctx = createMockContext({
      responses: {
        staff_schedules: { data: [validScheduleWithStaff], error: null },
      },
    });
    const schedules = createSchedulesWrapper(ctx);
    const result = await schedules.findByDate('2025-02-23');
    expect(result).toEqual([validScheduleWithStaff]);
  });

  it('findByStaffAndDate returns staff schedules', async () => {
    const ctx = createMockContext({
      responses: {
        staff_schedules: { data: [validScheduleWithStaff], error: null },
      },
    });
    const schedules = createSchedulesWrapper(ctx);
    const result = await schedules.findByStaffAndDate(validSchedule.staff_id, '2025-02-23');
    expect(result).toEqual([validScheduleWithStaff]);
  });

  it('findByStaffRange returns schedules in range', async () => {
    const ctx = createMockContext({
      responses: {
        staff_schedules: { data: [validScheduleWithStaff], error: null },
      },
    });
    const schedules = createSchedulesWrapper(ctx);
    const result = await schedules.findByStaffRange(
      validSchedule.staff_id,
      '2025-02-20',
      '2025-02-28',
    );
    expect(result).toEqual([validScheduleWithStaff]);
  });

  it('findByDateRange returns all schedules in range', async () => {
    const ctx = createMockContext({
      responses: {
        staff_schedules: { data: [validScheduleWithStaff], error: null },
      },
    });
    const schedules = createSchedulesWrapper(ctx);
    const result = await schedules.findByDateRange('2025-02-20', '2025-02-28');
    expect(result).toEqual([validScheduleWithStaff]);
  });

  it('markInProgress updates status and actual_start', async () => {
    const inProgress = {
      ...validScheduleWithStaff,
      status: 'in_progress',
      actual_start: '2025-02-23T09:15:00Z',
    };
    const ctx = createMockContext({
      responses: {
        staff_schedules: { data: inProgress, error: null },
      },
    });
    const schedules = createSchedulesWrapper(ctx);
    const result = await schedules.markInProgress(validSchedule.id, '2025-02-23T09:15:00Z');
    expect(result).toEqual(inProgress);
    expect(ctx.getCalls()[0].method).toBe('update');
  });

  it('markCompleted updates status', async () => {
    const completed = {
      ...validScheduleWithStaff,
      status: 'completed',
      actual_end: '2025-02-23T17:30:00Z',
    };
    const ctx = createMockContext({
      responses: {
        staff_schedules: { data: completed, error: null },
      },
    });
    const schedules = createSchedulesWrapper(ctx);
    const result = await schedules.markCompleted(validSchedule.id, '2025-02-23T17:30:00Z');
    expect(result).toEqual(completed);
  });

  it('markMissed updates status to missed', async () => {
    const missed = { ...validScheduleWithStaff, status: 'missed' };
    const ctx = createMockContext({
      responses: {
        staff_schedules: { data: missed, error: null },
      },
    });
    const schedules = createSchedulesWrapper(ctx);
    const result = await schedules.markMissed(validSchedule.id);
    expect(result).toEqual(missed);
  });

  it('throws on supabase error for create', async () => {
    const ctx = createMockContext({
      responses: {
        staff_schedules: { data: null, error: { code: '23505', message: 'duplicate' } },
      },
    });
    const schedules = createSchedulesWrapper(ctx);
    await expect(
      schedules.create(
        buildScheduleInsert({
          staff_id: 'test',
          date: '2025-02-23',
          planned_start: '09:00',
          planned_end: '17:00',
          status: 'scheduled',
        }),
      ),
    ).rejects.toThrow();
  });

  it('returns empty array when no schedules for date', async () => {
    const ctx = createMockContext({
      responses: {
        staff_schedules: { data: [], error: null },
      },
    });
    const schedules = createSchedulesWrapper(ctx);
    const result = await schedules.findByDate('2025-01-01');
    expect(result).toEqual([]);
  });

  it('throws ConflictError for duplicate key violation (23505)', async () => {
    const ctx = createMockContext({
      responses: {
        staff_schedules: { data: null, error: { code: '23505', message: 'duplicate key' } },
      },
    });
    const schedules = createSchedulesWrapper(ctx);
    await expect(
      schedules.create(
        buildScheduleInsert({
          staff_id: 'test',
          date: '2025-02-23',
          planned_start: '09:00',
          planned_end: '17:00',
          status: 'scheduled',
        }),
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('markCompleted without actualEnd only sets status to completed', async () => {
    const completed = { ...validScheduleWithStaff, status: 'completed', actual_end: null };
    const ctx = createMockContext({
      responses: {
        staff_schedules: { data: completed, error: null },
      },
    });
    const schedules = createSchedulesWrapper(ctx);
    const result = await schedules.markCompleted(validSchedule.id);
    expect(result).toEqual(completed);
    expect(result.status).toBe('completed');
    expect(result.actual_end).toBeNull();
    expect(ctx.getCalls()[0].method).toBe('update');
  });

  it('findByDateRange returns empty array when data is null', async () => {
    const ctx = createMockContext({
      responses: {
        staff_schedules: { data: null, error: null },
      },
    });
    const schedules = createSchedulesWrapper(ctx);
    const result = await schedules.findByDateRange('2025-03-01', '2025-03-31');
    expect(result).toEqual([]);
  });

  it('findByStaffRange returns empty array when data is null', async () => {
    const ctx = createMockContext({
      responses: {
        staff_schedules: { data: null, error: null },
      },
    });
    const schedules = createSchedulesWrapper(ctx);
    const result = await schedules.findByStaffRange('staff-1', '2025-03-01', '2025-03-31');
    expect(result).toEqual([]);
  });

  it('findByStaffAndDate returns empty array when data is null', async () => {
    const ctx = createMockContext({
      responses: {
        staff_schedules: { data: null, error: null },
      },
    });
    const schedules = createSchedulesWrapper(ctx);
    const result = await schedules.findByStaffAndDate('staff-1', '2025-03-01');
    expect(result).toEqual([]);
  });
});
