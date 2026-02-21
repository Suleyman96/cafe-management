import { handleSupabaseError } from '@cafe-idare/core';
import type { FeedbackInsert, FeedbackUpdate } from '@cafe-idare/database';
import type { QueryOptions, TypedSupabaseClient } from './types';

export interface FeedbackFilters extends QueryOptions {
  orderId?: string;
  fromDate?: string;
  toDate?: string;
  minRating?: number;
  maxRating?: number;
}

export async function getFeedback(client: TypedSupabaseClient, filters?: FeedbackFilters) {
  let query = client.from('feedback').select(`
      *,
      order:orders(
        *,
        table:tables(*),
        staff:staff(*)
      )
    `);

  if (filters?.orderId) {
    query = query.eq('order_id', filters.orderId);
  }

  if (filters?.fromDate) {
    query = query.gte('created_at', filters.fromDate);
  }

  if (filters?.toDate) {
    query = query.lte('created_at', filters.toDate);
  }

  if (filters?.minRating) {
    query = query.gte('rating', filters.minRating);
  }

  if (filters?.maxRating) {
    query = query.lte('rating', filters.maxRating);
  }

  query = query.order(filters?.orderBy || 'created_at', {
    ascending: filters?.ascending ?? false,
  });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw handleSupabaseError(error);
  return data;
}

export async function getFeedbackItem(client: TypedSupabaseClient, id: string) {
  const { data, error } = await client
    .from('feedback')
    .select(`
      *,
      order:orders(
        *,
        table:tables(*),
        staff:staff(*)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw handleSupabaseError(error);
  return data;
}

export async function createFeedback(client: TypedSupabaseClient, feedback: FeedbackInsert) {
  const { data, error } = await (client as any).from('feedback').insert(feedback).select().single();

  if (error) throw handleSupabaseError(error);
  return data;
}

export async function updateFeedback(
  client: TypedSupabaseClient,
  id: string,
  updates: FeedbackUpdate,
) {
  const { data, error } = await (client as any)
    .from('feedback')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw handleSupabaseError(error);
  return data;
}

export async function getAverageRating(client: TypedSupabaseClient, filters?: FeedbackFilters) {
  const { data, error } = await (client as any).rpc('get_average_rating', {
    from_date: filters?.fromDate,
    to_date: filters?.toDate,
  });

  if (error) throw handleSupabaseError(error);
  return data;
}
