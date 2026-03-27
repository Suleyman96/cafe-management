import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { CallStaffModal } from '@/components/waiter/call-staff-modal';
import { db } from '@/lib/supabase';
import { renderWithProviders, screen, waitFor } from '../helpers/test-utils';

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

  it('sends waiter call with correct table UUID and reason', async () => {
    const user = userEvent.setup();

    (db.waiterCalls.create as any).mockResolvedValueOnce({
      id: 'call-1',
      table_id: 'uuid-123',
      call_type: 'assistance',
      reason: 'callStaff.reason.assistance',
      priority: 'normal',
      status: 'pending',
    });

    renderWithProviders(<CallStaffModal {...defaultProps} />);

    // Click the "assistance" reason button
    const assistanceButton = screen.getByText('callStaff.reason.assistance');
    await user.click(assistanceButton);

    // Click the submit/call button
    const submitButton = screen.getByText('callStaff.callButton');
    await user.click(submitButton);

    await waitFor(() => {
      expect(db.waiterCalls.create).toHaveBeenCalledWith({
        table_id: 'uuid-123',
        call_type: 'assistance',
        reason: 'callStaff.reason.assistance',
        priority: 'normal',
      });
    });
  });

  it('shows success state after submit', async () => {
    const user = userEvent.setup();

    (db.waiterCalls.create as any).mockResolvedValueOnce({
      id: 'call-1',
      table_id: 'uuid-123',
      call_type: 'assistance',
      reason: 'callStaff.reason.assistance',
      priority: 'normal',
      status: 'pending',
    });

    renderWithProviders(<CallStaffModal {...defaultProps} />);

    // Select a reason and submit
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

    (db.waiterCalls.create as any).mockResolvedValueOnce({
      id: 'call-1',
      table_id: 'uuid-123',
      call_type: 'assistance',
      reason: 'callStaff.reason.assistance',
      priority: 'normal',
      status: 'pending',
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

    (db.waiterCalls.create as any).mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<CallStaffModal {...defaultProps} />);

    await user.click(screen.getByText('callStaff.reason.assistance'));
    await user.click(screen.getByText('callStaff.callButton'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('callStaff.toastError');
    });
  });
});
