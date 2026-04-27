import type { User } from '@supabase/supabase-js';

export interface StaffClaims {
  staff_id: string;
  tenant_id: string;
  user_role: string;
  is_active_staff: boolean;
}

/**
 * Extract staff claims from a verified JWT token.
 *
 * Claims are injected by the Supabase custom_access_token_hook into the JWT
 * payload (not into app_metadata), so we must decode the token directly.
 *
 * @param token - The access token, MUST have been verified by auth.getUser() first.
 * @param _user - The verified User object — required as proof that the caller
 *   already called auth.getUser(). Not used directly since claims live in the
 *   JWT payload, not in app_metadata.
 * @internal Only call from verifyStaff/verifyAdmin after token verification.
 */
export function getStaffClaims(_user: User, token: string): StaffClaims | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    if (!payload.is_active_staff) return null;
    return {
      staff_id: payload.staff_id,
      tenant_id: payload.tenant_id,
      user_role: payload.user_role,
      is_active_staff: payload.is_active_staff,
    };
  } catch {
    return null;
  }
}
