import userEvent from '@testing-library/user-event';
import { FeedbackForm } from '@/components/feedback/feedback-form';
import { apiRoutes } from '@/lib/api-routes';
import { act, renderWithProviders, screen, waitFor } from '../helpers/test-utils';

// PR3 / H1: FeedbackForm now writes through `/api/v1/customer/feedback`,
// not through `db.feedback.create`. Tests assert on the API route mock
// from `setup.ts`.

describe('FeedbackForm', () => {
  const defaultProps = {
    tableId: 't1',
    orderId: 'o1',
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
  };

  it('submits feedback with correct data shape', async () => {
    const user = userEvent.setup();

    (apiRoutes.customerFeedback.create as any).mockResolvedValueOnce({
      feedback: { id: 'fb-1' },
    });

    renderWithProviders(<FeedbackForm {...defaultProps} />);

    await user.click(screen.getByText('feedback.type.praise'));

    const messageInput = screen.getByRole('textbox', { name: /feedback\.messageLabel/i });
    await user.type(messageInput, 'Great food!');

    const submitButton = screen.getByText('feedback.submit');
    await user.click(submitButton);

    await waitFor(() => {
      expect(apiRoutes.customerFeedback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          table_id: 't1',
          order_id: 'o1',
          feedback_type: 'praise',
          message: 'Great food!',
        }),
      );
    });
    // Tenant-derivation moved server-side (H1) — body must NOT carry it.
    const payload = (apiRoutes.customerFeedback.create as any).mock.calls[0][0];
    expect(payload).not.toHaveProperty('tenant_id');
  });

  it('shows error toast for empty message', async () => {
    renderWithProviders(<FeedbackForm {...defaultProps} />);

    const submitButton = screen.getByText('feedback.submit');
    expect(submitButton).toBeDisabled();
    expect(apiRoutes.customerFeedback.create).not.toHaveBeenCalled();
  });

  it('shows success state after submission', async () => {
    const user = userEvent.setup();

    (apiRoutes.customerFeedback.create as any).mockResolvedValueOnce({
      feedback: { id: 'fb-1' },
    });

    renderWithProviders(<FeedbackForm {...defaultProps} />);

    await user.click(screen.getByText('feedback.type.complaint'));

    const messageInput = screen.getByRole('textbox', { name: /feedback\.messageLabel/i });
    await user.type(messageInput, 'Excellent service!');

    await user.click(screen.getByText('feedback.submit'));

    await waitFor(() => {
      expect(screen.getByText('feedback.successTitle')).toBeInTheDocument();
    });
  });

  it('prevents double submission', async () => {
    const user = userEvent.setup();

    let resolveCreate: (value: any) => void;
    (apiRoutes.customerFeedback.create as any).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    renderWithProviders(<FeedbackForm {...defaultProps} />);

    await user.click(screen.getByText('feedback.type.praise'));

    const messageInput = screen.getByRole('textbox', { name: /feedback\.messageLabel/i });
    await user.type(messageInput, 'Some feedback');

    const submitButton = screen.getByText('feedback.submit');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('feedback.submitting')).toBeInTheDocument();
    });

    expect(screen.getByText('feedback.submitting')).toBeDisabled();

    expect(apiRoutes.customerFeedback.create).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate!({ feedback: { id: 'fb-1' } });
    });
  });
});
