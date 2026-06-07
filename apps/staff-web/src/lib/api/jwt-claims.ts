import { USER_ROLE } from '@gustri/database';
import type { User } from '@supabase/supabase-js';

export interface StaffClaims {
  staff_id: string;
  tenant_id: string;
  user_role: string;
  is_active_staff: boolean;
}

// Single source of truth for valid roles (mirrors the USER_ROLE enum).
const VALID_ROLES = new Set<string>(Object.values(USER_ROLE));

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
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) return null;
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64').toString());
    if (!payload.is_active_staff) return null;
    // Defense-in-depth: a malformed or partial claim set must not flow
    // downstream as a half-populated staff object. A missing/null tenant_id in
    // particular could weaken tenant isolation, so reject unless every identity
    // field is present and the role is a known value. (The token signature is
    // already verified upstream by auth.getUser(); this guards shape, not trust.)
    if (
      typeof payload.staff_id !== 'string' ||
      typeof payload.tenant_id !== 'string' ||
      !VALID_ROLES.has(payload.user_role)
    ) {
      return null;
    }
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
