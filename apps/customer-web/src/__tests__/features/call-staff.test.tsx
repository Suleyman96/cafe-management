import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { CallStaffModal } from '@/components/waiter/call-staff-modal';
import { apiRoutes } from '@/lib/api-routes';
import { renderWithProviders, screen, waitFor } from '../helpers/test-utils';

// PR3 / H1: CallStaffModal now writes through `/api/v1/customer/waiter-calls`
// rather than `db.waiterCalls.create`. The route mock in `setup.ts` is the
// fixture point; per-test `mockResolvedValueOnce`/`mockRejectedValueOnce`
// drive specific scenarios.

describe('CallStaffModal', () => {
  const defaultProps = {
    tableId: 'uuid-123',
    isOpen: true,
    onClose: vi.fn(),
  };

  it('does not render when isOpen is false', () => {
    renderWithProviders(<CallStaffModal tableId="uuid-123" isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByText('callStaff.title')).not.toBeInTheDocument();
  });

  it('sends waiter call with correct table id, type, and priority', async () => {
    const user = userEvent.setup();

    (apiRoutes.customerWaiterCalls.create as any).mockResolvedValueOnce({
      waiter_call: {
        id: 'call-1',
        table_id: 'uuid-123',
        call_type: 'assistance',
        reason: 'callStaff.reason.assistance',
        priority: 'normal',
        status: 'pending',
      },
    });

    renderWithProviders(<CallStaffModal {...defaultProps} />);

    await user.click(screen.getByText('callStaff.reason.assistance'));
    await user.click(screen.getByText('callStaff.callButton'));

    await waitFor(() => {
      expect(apiRoutes.customerWaiterCalls.create).toHaveBeenCalledWith(
        expect.objectContaining({
          table_id: 'uuid-123',
          call_type: 'assistance',
          reason: 'callStaff.reason.assistance',
          priority: 'normal',
        }),
      );
    });
    // Tenant-derivation moved server-side (H1) — body must NOT carry it.
    const payload = (apiRoutes.customerWaiterCalls.create as any).mock.calls[0][0];
    expect(payload).not.toHaveProperty('tenant_id');
  });

  it('shows success state after submit', async () => {
    const user = userEvent.setup();

    (apiRoutes.customerWaiterCalls.create as any).mockResolvedValueOnce({
      waiter_call: {
        id: 'call-1',
        table_id: 'uuid-123',
        call_type: 'assistance',
        reason: 'callStaff.reason.assistance',
        priority: 'normal',
        status: 'pending',
      },
    });

    renderWithProviders(<CallStaffModal {...defaultProps} />);

    await user.click(screen.getByText('callStaff.reason.assistance'));
    await user.click(screen.getByText('callStaff.callButton'));

    await waitFor(() => {
      expect(screen.getByText('callStaff.successMessage')).toBeInTheDocument();
    });
  });

  it('submit is disabled without selecting a reason', () => {
    renderWithProviders(<CallStaffModal {...defaultProps} />);

    const submitButton = screen.getByText('callStaff.callButton');
    expect(submitButton).toBeDisabled();
  });

  it('shows success toast after successful waiter call', async () => {
    const user = userEvent.setup();

    (apiRoutes.customerWaiterCalls.create as any).mockResolvedValueOnce({
      waiter_call: {
        id: 'call-1',
        table_id: 'uuid-123',
        call_type: 'assistance',
        reason: 'callStaff.reason.assistance',
        priority: 'normal',
        status: 'pending',
      },
    });

    renderWithProviders(<CallStaffModal {...defaultProps} />);

    await user.click(screen.getByText('callStaff.reason.assistance'));
    await user.click(screen.getByText('callStaff.callButton'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('callStaff.toastSuccess');
    });
  });

  it('shows error toast when waiter call fails', async () => {
    const user = userEvent.setup();

    (apiRoutes.customerWaiterCalls.create as any).mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<CallStaffModal {...defaultProps} />);

    await user.click(screen.getByText('callStaff.reason.assistance'));
    await user.click(screen.getByText('callStaff.callButton'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('callStaff.toastError');
    });
  });
});
