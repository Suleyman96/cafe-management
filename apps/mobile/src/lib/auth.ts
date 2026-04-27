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
  const staff = (await db.staff.findByAuthId(data.user.id)) as Staff;

  if (!staff?.is_active) {
    await supabase.auth.signOut();
    throw new Error('Account is deactivated');
  }

  // Fire-and-forget — don't block login for a non-critical timestamp update
  db.staff.updateLastLogin(staff.id).catch(() => {});

  return { user: data.user, staff };
}

export async function logout() {
  // Remove all Realtime channels before signing out to prevent
  // ghost subscriptions with stale tenant context
  const channels = supabase.getChannels();
  for (const channel of channels) {
    supabase.removeChannel(channel);
  }

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
    const staff = (await db.staff.findByAuthId(user.id)) as Staff;
    if (!staff?.is_active) {
      await supabase.auth.signOut();
      return null;
    }
    return staff;
  } catch {
    return null;
  }
}

export function onAuthStateChange(callback: (staff: Staff | null) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      const channels = supabase.getChannels();
      for (const channel of channels) {
        supabase.removeChannel(channel);
      }
      callback(null);
      return;
    }

    if (
      (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') &&
      session.user
    ) {
      try {
        const staff = (await db.staff.findByAuthId(session.user.id)) as Staff;
        if (!staff?.is_active) {
          await supabase.auth.signOut();
          callback(null);
          return;
        }
        callback(staff);
      } catch {
        callback(null);
      }
    }
  });
}
