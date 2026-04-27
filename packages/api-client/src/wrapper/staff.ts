/**
 * Staff wrapper module
 */

import { handleSupabaseError, isStaff, isStaffArray } from '@gustri/core';
import type { StaffInsert, StaffUpdate, WrapperContext } from './types';

export function createStaffWrapper(ctx: WrapperContext) {
  return {
    findAll: async (options?: { role?: string }) => {
      let query = ctx.client.from('staff').select('*').order('full_name').limit(200);

      if (options?.role) {
        query = query.eq('role', options.role);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      const staff = data || [];
      if (!isStaffArray(staff)) throw new Error('Invalid staff data');
      return staff;
    },

    findById: async (id: string) => {
      const { data, error } = await ctx.client.from('staff').select('*').eq('id', id).single();

      if (error) throw handleSupabaseError(error);
      if (!isStaff(data)) throw new Error('Invalid staff data');
      return data;
    },

    findByEmail: async (email: string) => {
      const { data, error } = await ctx.client
        .from('staff')
        .select('*')
        .eq('email', email)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStaff(data)) throw new Error('Invalid staff data');
      return data;
    },

    findByAuthId: async (authUserId: string) => {
      const { data, error } = await ctx.client
        .from('staff')
        .select('*')
        .eq('auth_user_id', authUserId)
        .eq('is_active', true)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStaff(data)) throw new Error('Invalid staff data');
      return data;
    },

    create: async (staffData: StaffInsert) => {
      const { data, error } = await ctx.anyClient.from('staff').insert(staffData).select().single();

      if (error) throw handleSupabaseError(error);
      if (!isStaff(data)) throw new Error('Invalid staff data');
      return data;
    },

    update: async (id: string, updates: StaffUpdate) => {
      const { data, error } = await ctx.anyClient
        .from('staff')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStaff(data)) throw new Error('Invalid staff data');
      return data;
    },

    delete: async (id: string) => {
      const { error } = await ctx.anyClient.from('staff').update({ is_active: false }).eq('id', id);

      if (error) throw handleSupabaseError(error);
    },

    getActiveWaiters: async () => {
      const { data, error } = await ctx.client
        .from('staff')
        .select('*')
        .eq('role', 'waiter')
        .eq('is_active', true)
        .order('full_name')
        .limit(100);

      if (error) throw handleSupabaseError(error);
      const waiters = data || [];
      if (!isStaffArray(waiters)) throw new Error('Invalid staff data');
      return waiters;
    },

    updatePushToken: async (staffId: string, pushToken: string | null) => {
      const { error } = await ctx.anyClient
        .from('staff')
        .update({ push_token: pushToken })
        .eq('id', staffId);

      if (error) throw handleSupabaseError(error);
    },

    updateLastLogin: async (staffId: string) => {
      const { error } = await ctx.anyClient
        .from('staff')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', staffId);

      if (error) throw handleSupabaseError(error);
    },
  };
}

export type StaffWrapper = ReturnType<typeof createStaffWrapper>;
