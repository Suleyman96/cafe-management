import type { Staff } from '@/types';
import { db, supabase } from './supabase';

export interface LoginCredentials {
  email: string;
  password: string;
}

export async function login({ email, password }: LoginCredentials) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Fetch staff profile via wrapper
  const staff = await db.staff.findByAuthId(data.user.id);

  // Update last login
  await db.staff.updateLastLogin(staff.id);

  return { user: data.user, staff };
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<Staff | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  try {
    return await db.staff.findByAuthId(user.id);
  } catch {
    return null;
  }
}

export function onAuthStateChange(callback: (staff: Staff | null) => void) {
  return supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      try {
        const staff = await db.staff.findByAuthId(session.user.id);
        callback(staff);
      } catch {
        callback(null);
      }
    } else {
      callback(null);
    }
  });
}
