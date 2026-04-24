export interface StaffClaims {
  staff_id: string;
  tenant_id: string;
  user_role: string;
  is_active_staff: boolean;
}

export function getStaffClaims(accessToken: string): StaffClaims | null {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
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
