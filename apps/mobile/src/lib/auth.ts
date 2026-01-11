import { supabase } from "./supabase";
import type { Staff } from "@/types";

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
  
  // Fetch staff profile
  const { data: staffData, error: staffError } = await supabase
    .from("staff")
    .select("*")
    .eq("auth_user_id", data.user.id)
    .single();

  if (staffError) throw staffError;

  // Update last login
  await supabase
    .from("staff")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", staffData.id);

  return { user: data.user, staff: staffData as Staff };
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) return null;

  // Fetch staff profile
  const { data: staffData } = await supabase
    .from("staff")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  return staffData as Staff | null;
}

export function onAuthStateChange(callback: (staff: Staff | null) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const { data } = await supabase
        .from("staff")
        .select("*")
        .eq("auth_user_id", session.user.id)
        .single();
      
      callback(data as Staff | null);
    } else {
      callback(null);
    }
  });
}


