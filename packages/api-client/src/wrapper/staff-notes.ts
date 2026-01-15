/**
 * Staff notes wrapper module
 */

import { handleSupabaseError } from '@cafe-idare/core';
import type { WrapperContext } from './types';
import type { Database } from '@cafe-idare/database';

type StaffNoteRow = Database['public']['Tables']['staff_notes']['Row'];
type StaffNoteInsert = Database['public']['Tables']['staff_notes']['Insert'];
type StaffNoteUpdate = Database['public']['Tables']['staff_notes']['Update'];

export function createStaffNotesWrapper(ctx: WrapperContext) {
  return {
    findAll: async (options?: { includeExpired?: boolean }) => {
      let query = ctx.client
        .from('staff_notes')
        .select(`
          *,
          created_by_staff:staff!staff_notes_created_by_fkey(full_name, role)
        `)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      // By default, exclude expired notes
      if (!options?.includeExpired) {
        query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findById: async (id: string) => {
      const { data, error } = await ctx.client
        .from('staff_notes')
        .select(`
          *,
          created_by_staff:staff!staff_notes_created_by_fkey(full_name, role)
        `)
        .eq('id', id)
        .single();

      if (error) throw handleSupabaseError(error);
      return data;
    },

    create: async (noteData: StaffNoteInsert) => {
      const { data, error } = await ctx.anyClient
        .from('staff_notes')
        .insert(noteData)
        .select(`
          *,
          created_by_staff:staff!staff_notes_created_by_fkey(full_name, role)
        `)
        .single();

      if (error) throw handleSupabaseError(error);
      return data as StaffNoteRow;
    },

    update: async (id: string, updates: StaffNoteUpdate) => {
      const { data, error } = await ctx.anyClient
        .from('staff_notes')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          created_by_staff:staff!staff_notes_created_by_fkey(full_name, role)
        `)
        .single();

      if (error) throw handleSupabaseError(error);
      return data as StaffNoteRow;
    },

    delete: async (id: string) => {
      const { error } = await ctx.anyClient
        .from('staff_notes')
        .delete()
        .eq('id', id);

      if (error) throw handleSupabaseError(error);
    },

    togglePin: async (id: string) => {
      // First get current state
      const { data: current, error: fetchError } = await ctx.anyClient
        .from('staff_notes')
        .select('is_pinned')
        .eq('id', id)
        .single();

      if (fetchError) throw handleSupabaseError(fetchError);
      if (!current) throw new Error('Note not found');

      // Toggle the state
      const { data, error } = await ctx.anyClient
        .from('staff_notes')
        .update({ is_pinned: !(current as { is_pinned: boolean }).is_pinned })
        .eq('id', id)
        .select(`
          *,
          created_by_staff:staff!staff_notes_created_by_fkey(full_name, role)
        `)
        .single();

      if (error) throw handleSupabaseError(error);
      return data as StaffNoteRow;
    },
  };
}

export type StaffNotesWrapper = ReturnType<typeof createStaffNotesWrapper>;
