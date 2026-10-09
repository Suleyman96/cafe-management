/**
 * Staff wrapper module
 */

import { isStaff, isStaffArray } from '@gustri/core';
import { handleSupabaseError } from '../errors';
import { applyTenantScope, assertInsertTenantMatches } from './_tenant-scope';
import type { StaffInsert, StaffRow, StaffUpdate, WrapperContext } from './types';

// Explicit projections — keep `auth_user_id` and `pin_hash` server-side only.
// `pin_set_at` is exposed because the client-side soft-lock gate (Plan 13)
// only mounts when the staff member already has a PIN configured.
const STAFF_LIST_SELECT = 'id, email, full_name, role, is_active, created_at, updated_at' as const;
const STAFF_DETAIL_SELECT =
  'id, email, full_name, role, is_active, phone, preferred_language, created_at, updated_at, last_login_at, tenant_id, pin_set_at' as const;

// M6 — explicit allow-list of columns `update` may write. Blocks
// mass-assignment of identity / tenant / security columns that would enable
// cross-tenant takeover or auth bypass if a caller slipped them into
// `updates`: `tenant_id` (reassign a staff row to another tenant),
// `auth_user_id` (hijack an auth identity), `pin_hash` (auth bypass),
// `id`/`created_at`/`updated_at` (immutable). `role` and `is_active` stay
// updatable because the admin staff-edit UI sets them and who may do so is
// enforced server-side (RLS + `verifyAdmin`); dropping them here would
// silently break legitimate staff editing.
const STAFF_UPDATE_ALLOWED_FIELDS = [
  'full_name',
  'email',
  'phone',
  'preferred_language',
  'role',
  'is_active',
  'pin_set_at',
] as const;

function pickStaffUpdatableFields(updates: StaffUpdate): Partial<StaffUpdate> {
  const safe: Record<string, unknown> = {};
  const source = updates as Record<string, unknown>;
  for (const key of STAFF_UPDATE_ALLOWED_FIELDS) {
    if (key in source && source[key] !== undefined) {
      safe[key] = source[key];
    }
  }
  return safe as Partial<StaffUpdate>;
}

export function createStaffWrapper(ctx: WrapperContext) {
  return {
    findAll: async (options?: { role?: StaffRow['role']; limit?: number }) => {
      const limit = options?.limit ?? 200;
      let query = applyTenantScope(
        ctx.client.from('staff').select(STAFF_LIST_SELECT).order('full_name').limit(limit),
        ctx,
      );

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
      const { data, error } = await applyTenantScope(
        ctx.client.from('staff').select(STAFF_DETAIL_SELECT).eq('id', id),
        ctx,
      ).single();

      if (error) throw handleSupabaseError(error);
      if (!isStaff(data)) throw new Error('Invalid staff data');
      return data;
    },

    findByEmail: async (email: string) => {
      const { data, error } = await applyTenantScope(
        ctx.client.from('staff').select(STAFF_DETAIL_SELECT).eq('email', email),
        ctx,
      ).single();

      if (error) throw handleSupabaseError(error);
      if (!isStaff(data)) throw new Error('Invalid staff data');
      return data;
    },

    findByAuthId: async (authUserId: string) => {
      // Login flow: tenant context is bound from auth.uid() lookup, so this
      // call resolves before setTenantContext() — must allow null. Detail
      // projection includes tenant_id so the caller can bind context.
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('staff')
          .select(STAFF_DETAIL_SELECT)
          .eq('auth_user_id', authUserId)
          .eq('is_active', true),
        ctx,
        { allowNull: true },
      ).single();

      if (error) throw handleSupabaseError(error);
      if (!isStaff(data)) throw new Error('Invalid staff data');
      return data;
    },

    create: async (staffData: StaffInsert) => {
      assertInsertTenantMatches(staffData, ctx);
      const { data, error } = await ctx.anyClient
        .from('staff')
        .insert(staffData)
        .select(STAFF_DETAIL_SELECT)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStaff(data)) throw new Error('Invalid staff data');
      return data;
    },

    update: async (id: string, updates: StaffUpdate) => {
      // M6 — strip non-allow-listed columns (mass-assignment guard) and
      // scope the write to the bound tenant (defense-in-depth on top of RLS)
      // so an `id` from another tenant can't be updated.
      const safeUpdates = pickStaffUpdatableFields(updates);
      const { data, error } = await applyTenantScope(
        ctx.anyClient.from('staff').update(safeUpdates).eq('id', id),
        ctx,
      )
        .select(STAFF_DETAIL_SELECT)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isStaff(data)) throw new Error('Invalid staff data');
      return data;
    },

    delete: async (id: string) => {
      // M6 — tenant-scope the soft-delete so a cross-tenant id is a no-op.
      const { error } = await applyTenantScope(
        ctx.anyClient.from('staff').update({ is_active: false }).eq('id', id),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
    },

    getActiveWaiters: async () => {
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('staff')
          .select(STAFF_LIST_SELECT)
          .eq('role', 'waiter')
          .eq('is_active', true)
          .order('full_name')
          .limit(100),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      const waiters = data || [];
      if (!isStaffArray(waiters)) throw new Error('Invalid staff data');
      return waiters;
    },

    updateLastLogin: async (staffId: string) => {
      // M6 — tenant-scope the refetch/write. During the login flow tenant
      // context may not be bound yet, in which case applyTenantScope is a
      // no-op (same as before) and RLS remains the boundary.
      const { error } = await applyTenantScope(
        ctx.anyClient
          .from('staff')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', staffId),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
    },
  };
}

export type StaffWrapper = ReturnType<typeof createStaffWrapper>;
