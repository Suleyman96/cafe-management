/**
 * Staff schedules wrapper module
 */

import { isStaffSchedule } from '@gustri/core';
import { handleSupabaseError } from '../errors';
import { applyTenantScope, assertInsertTenantMatches } from './_tenant-scope';
import type { StaffScheduleInsert, StaffScheduleUpdate, WrapperContext } from './types';

const STAFF_JOIN = `
  *,
  staff:staff!staff_schedules_staff_id_fkey(id, full_name, role)
`;

export function createSchedulesWrapper(ctx: WrapperContext) {
  return {
    create: async (data: StaffScheduleInsert) => {
      assertInsertTenantMatches(data, ctx);
      const { data: result, error } = await ctx.anyClient
        .from('staff_schedules')
        .insert(data)
        .select(STAFF_JOIN)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStaffSchedule(result)) throw new Error('Invalid schedule data');
      return result;
    },

    update: async (id: string, data: StaffScheduleUpdate) => {
      const { data: result, error } = await ctx.anyClient
        .from('staff_schedules')
        .update(data)
        .eq('id', id)
        .select(STAFF_JOIN)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStaffSchedule(result)) throw new Error('Invalid schedule data');
      return result;
    },

    delete: async (id: string) => {
      const { error } = await ctx.anyClient.from('staff_schedules').delete().eq('id', id);

      if (error) throw handleSupabaseError(error);
    },

    findByDate: async (date: string) => {
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('staff_schedules')
          .select(STAFF_JOIN)
          .eq('date', date)
          .order('planned_start', { ascending: true }),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findByStaffAndDate: async (staffId: string, date: string) => {
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('staff_schedules')
          .select(STAFF_JOIN)
          .eq('staff_id', staffId)
          .eq('date', date)
          .order('planned_start', { ascending: true }),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findByStaffRange: async (staffId: string, startDate: string, endDate: string) => {
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('staff_schedules')
          .select(STAFF_JOIN)
          .eq('staff_id', staffId)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true })
          .order('planned_start', { ascending: true }),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findByDateRange: async (startDate: string, endDate: string) => {
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('staff_schedules')
          .select(STAFF_JOIN)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true })
          .order('planned_start', { ascending: true }),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    markInProgress: async (id: string, actualStart: string) => {
      const { data, error } = await ctx.anyClient
        .from('staff_schedules')
        .update({ status: 'in_progress', actual_start: actualStart })
        .eq('id', id)
        .select(STAFF_JOIN)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStaffSchedule(data)) throw new Error('Invalid schedule data');
      return data;
    },

    markCompleted: async (id: string, actualEnd?: string) => {
      const updateData: Record<string, string> = { status: 'completed' };
      if (actualEnd) updateData.actual_end = actualEnd;

      const { data, error } = await ctx.anyClient
        .from('staff_schedules')
        .update(updateData)
        .eq('id', id)
        .select(STAFF_JOIN)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStaffSchedule(data)) throw new Error('Invalid schedule data');
      return data;
    },

    markMissed: async (id: string) => {
      const { data, error } = await ctx.anyClient
        .from('staff_schedules')
        .update({ status: 'missed' })
        .eq('id', id)
        .select(STAFF_JOIN)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStaffSchedule(data)) throw new Error('Invalid schedule data');
      return data;
    },
  };
}

export type SchedulesWrapper = ReturnType<typeof createSchedulesWrapper>;
