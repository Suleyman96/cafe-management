import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockAdminStaff, mockWaiterStaff } from '../../helpers/mock-auth';
import { renderWithProviders } from '../../helpers/test-utils';

// C3 — when admin flips `is_active: true → false`, the modal must call
// `/api/v1/staff/revoke-sessions` so the deactivated user's refresh
// tokens are invalidated. Other field edits (name, role, phone) and
// reactivation must NOT trigger the revoke call.

const mockUpdateStaff = { mutateAsync: vi.fn().mockResolvedValue({}) };
const mockUseStaffMember = vi.fn().mockReturnValue({ data: { phone: '+12345' } });

vi.mock('@/hooks', () => ({
  useStaffMember: (...args: unknown[]) => mockUseStaffMember(...args),
  useUpdateStaff: () => mockUpdateStaff,
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok-abc' } } }),
    },
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: any) => <button {...props} />,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { StaffEditModal } from '@/components/modals/staff-edit-modal';

describe('StaffEditModal — C3 revoke-sessions on deactivation', () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  afterEach(() => {
    vi.restoreAllMocks();
    mockUpdateStaff.mutateAsync.mockClear();
    onSuccess.mockClear();
  });

  function renderModal(staff = { ...mockWaiterStaff, is_active: true }) {
    return renderWithProviders(
      <StaffEditModal
        staff={staff as any}
        currentUserRole={mockAdminStaff.role}
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );
  }

  function fetchMock() {
    return vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, revoked: 2 }), { status: 200 }),
      );
  }

  it('calls /api/v1/staff/revoke-sessions when is_active flips true → false', async () => {
    const fetchSpy = fetchMock();
    renderModal();

    // Test setup mock i18n returns the raw key when no translation is
    // registered; `staffMgmt.accountActive` and `saveChanges` aren't in
    // the small mock map, so query by the literal key text.
    fireEvent.click(screen.getByLabelText('staffMgmt.accountActive'));
    fireEvent.click(screen.getByText('saveChanges'));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    const revokeCalls = fetchSpy.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/api/v1/staff/revoke-sessions'),
    );
    expect(revokeCalls).toHaveLength(1);

    const [, init] = revokeCalls[0]!;
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse(((init as RequestInit).body as string) ?? '{}')).toEqual({
      staffId: mockWaiterStaff.id,
    });
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok-abc');
  });

  it('does NOT call revoke-sessions when is_active stays true (other-field edit)', async () => {
    const fetchSpy = fetchMock();
    renderModal();

    fireEvent.change(screen.getByDisplayValue(mockWaiterStaff.full_name as string), {
      target: { value: 'New Name' },
    });
    fireEvent.click(screen.getByText('saveChanges'));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    const revokeCalls = fetchSpy.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/api/v1/staff/revoke-sessions'),
    );
    expect(revokeCalls).toHaveLength(0);
  });

  it('does NOT call revoke-sessions when reactivating (is_active false → true)', async () => {
    const fetchSpy = fetchMock();
    renderModal({ ...mockWaiterStaff, is_active: false });

    // Test setup mock i18n returns the raw key when no translation is
    // registered; `staffMgmt.accountActive` and `saveChanges` aren't in
    // the small mock map, so query by the literal key text.
    fireEvent.click(screen.getByLabelText('staffMgmt.accountActive'));
    fireEvent.click(screen.getByText('saveChanges'));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    const revokeCalls = fetchSpy.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/api/v1/staff/revoke-sessions'),
    );
    expect(revokeCalls).toHaveLength(0);
  });

  it('still reports success when revoke-sessions itself fails', async () => {
    // Network or 500 from the revoke endpoint must not undo the
    // deactivation toast — the is_active_staff JWT claim still gates
    // the user out within the access-token TTL regardless.
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    renderModal();

    // Test setup mock i18n returns the raw key when no translation is
    // registered; `staffMgmt.accountActive` and `saveChanges` aren't in
    // the small mock map, so query by the literal key text.
    fireEvent.click(screen.getByLabelText('staffMgmt.accountActive'));
    fireEvent.click(screen.getByText('saveChanges'));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(mockUpdateStaff.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ updates: expect.objectContaining({ is_active: false }) }),
    );
  });
});
