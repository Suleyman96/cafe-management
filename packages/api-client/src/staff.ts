import { TypedSupabaseClient } from './types';
import { handleSupabaseError, USER_ROLE } from '@cafe-idare/core';
import type { StaffInsert, StaffUpdate } from '@cafe-idare/database';

export async function getStaff(
  client: TypedSupabaseClient,
  role?: keyof typeof USER_ROLE
) {
  let query = client
    .from('staff')
    .select('*')
    .order('full_name');
    
  if (role) {
    query = query.eq('role', USER_ROLE[role]);
  }
  
  const { data, error } = await query;
  
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function getStaffMember(
  client: TypedSupabaseClient,
  id: string
) {
  const { data, error } = await client
    .from('staff')
    .select('*')
    .eq('id', id)
    .single();
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function getStaffByEmail(
  client: TypedSupabaseClient,
  email: string
) {
  const { data, error } = await client
    .from('staff')
    .select('*')
    .eq('email', email)
    .single();
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function createStaff(
  client: TypedSupabaseClient,
  staff: StaffInsert
) {
  const { data, error } = await (client as any)
    .from('staff')
    .insert(staff)
    .select()
    .single();
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function updateStaff(
  client: TypedSupabaseClient,
  id: string,
  updates: StaffUpdate
) {
  const { data, error } = await (client as any)
    .from('staff')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function deleteStaff(
  client: TypedSupabaseClient,
  id: string
) {
  const { error } = await (client as any)
    .from('staff')
    .delete()
    .eq('id', id);
    
  if (error) throw handleSupabaseError(error);
}

export async function getActiveWaiters(
  client: TypedSupabaseClient
) {
  return getStaff(client, 'WAITER');
}