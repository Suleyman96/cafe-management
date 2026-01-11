import { TypedSupabaseClient } from './types';
import { handleSupabaseError } from '@cafe-idare/core';

export interface SalesFilters {
  fromDate?: string;
  toDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}

export async function getSalesSummary(
  client: TypedSupabaseClient,
  filters?: SalesFilters
) {
  const { data, error } = await (client as any)
    .from('sales_summary_view')
    .select('*')
    .gte('date', filters?.fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .lte('date', filters?.toDate || new Date().toISOString())
    .order('date', { ascending: false });
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function getTopMenuItems(
  client: TypedSupabaseClient,
  limit: number = 10,
  filters?: SalesFilters
) {
  const { data, error } = await (client as any)
    .rpc('get_top_menu_items', {
      from_date: filters?.fromDate,
      to_date: filters?.toDate,
      limit_count: limit
    });
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function getRevenueByCategory(
  client: TypedSupabaseClient,
  filters?: SalesFilters
) {
  const { data, error } = await (client as any)
    .rpc('get_revenue_by_category', {
      from_date: filters?.fromDate,
      to_date: filters?.toDate
    });
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function getOrderStats(
  client: TypedSupabaseClient,
  filters?: SalesFilters
) {
  const { data, error } = await (client as any)
    .rpc('get_order_stats', {
      from_date: filters?.fromDate,
      to_date: filters?.toDate
    });
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function getStaffPerformance(
  client: TypedSupabaseClient,
  filters?: SalesFilters
) {
  const { data, error } = await (client as any)
    .rpc('get_staff_performance', {
      from_date: filters?.fromDate,
      to_date: filters?.toDate
    });
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function getTableTurnover(
  client: TypedSupabaseClient,
  filters?: SalesFilters
) {
  const { data, error } = await (client as any)
    .rpc('get_table_turnover', {
      from_date: filters?.fromDate,
      to_date: filters?.toDate
    });
    
  if (error) throw handleSupabaseError(error);
  return data;
}