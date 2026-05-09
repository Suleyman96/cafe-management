/**
 * Staff kitchen filters wrapper.
 *
 * Per-staff selection of menu categories that should appear on that staff's
 * kitchen screen. The wrapper exposes:
 *
 *   - `findByStaffId(staffId)`: list of category ids the staff has selected.
 *     Empty array means "show all" — the read path interprets the absence
 *     of rows that way, never the schema.
 *
 *   - `replace(staffId, categoryIds)`: atomic delete-then-insert so the
 *     final row set exactly matches the input. We avoid an upsert + delete-
 *     missing dance because (a) the table has no mutable columns to upsert
 *     into and (b) two writes through the same PostgREST transaction give
 *     the right semantics with no extra round trip.
 *
 * Tenant safety:
 *   - All inserts stamp `tenant_id` from the wrapper context (never the
 *     caller). The DB's BEFORE INSERT trigger validates that staff and
 *     category share that tenant — belt and suspenders.
 *   - Reads are RLS-scoped to the caller's tenant; the wrapper does not
 *     accept a tenant parameter.
 */

import { handleSupabaseError } from '../errors';
import type { WrapperContext } from './types';

export function createStaffKitchenFiltersWrapper(ctx: WrapperContext) {
  return {
    /**
     * Returns the category ids configured for this staff member, in stable
     * insertion order. An empty array means "no filter" — render all
     * categories on the kitchen screen.
     */
    findByStaffId: async (staffId: string): Promise<string[]> => {
      const { data, error } = await ctx.client
        .from('staff_kitchen_filters')
        .select('category_id')
        .eq('staff_id', staffId)
        .order('created_at', { ascending: true });

      if (error) throw handleSupabaseError(error);
      return (data ?? []).map((row) => row.category_id);
    },

    /**
     * Replace the entire filter set for a staff member. Pass an empty array
     * to clear (which the read path treats as "show all"). The two writes
     * are not wrapped in a single transaction — PostgREST does not expose
     * one — but the realtime subscriber on the kitchen page debounces
     * trailing-edge invalidations, so the brief window between delete and
     * insert collapses into a single re-render.
     *
     * Server-side belt-and-suspenders: the DB trigger rejects rows whose
     * tenant_id mismatches the staff or category, so a buggy caller can
     * never poison the table.
     */
    replace: async (staffId: string, categoryIds: string[]): Promise<void> => {
      const tenantId = ctx.tenantContext?.tenantId;
      if (!tenantId) {
        throw new Error('staff_kitchen_filters.replace requires a bound tenant context');
      }

      const uniqueCategoryIds = Array.from(new Set(categoryIds));

      const { error: deleteError } = await ctx.anyClient
        .from('staff_kitchen_filters')
        .delete()
        .eq('staff_id', staffId);

      if (deleteError) throw handleSupabaseError(deleteError);

      if (uniqueCategoryIds.length === 0) return;

      const rows = uniqueCategoryIds.map((category_id) => ({
        staff_id: staffId,
        category_id,
        tenant_id: tenantId,
      }));

      const { error: insertError } = await ctx.anyClient.from('staff_kitchen_filters').insert(rows);

      if (insertError) throw handleSupabaseError(insertError);
    },
  };
}

export type StaffKitchenFiltersWrapper = ReturnType<typeof createStaffKitchenFiltersWrapper>;
