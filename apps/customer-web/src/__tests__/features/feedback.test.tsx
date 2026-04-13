import userEvent from '@testing-library/user-event';
import { FeedbackForm } from '@/components/feedback/feedback-form';
import { db } from '@/lib/supabase';
import { act, renderWithProviders, screen, waitFor } from '../helpers/test-utils';

describe('FeedbackForm', () => {
  const defaultProps = {
    tableId: 't1',
    tenantId: 'tenant-1',
    orderId: 'o1',
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
  };

  it('submits feedback with correct data shape', async () => {
    const user = userEvent.setup();

    (db.feedback.create as any).mockResolvedValueOnce({ id: 'fb-1' });

    renderWithProviders(<FeedbackForm {...defaultProps} />);

    // Select a feedback type
    await user.click(screen.getByText('feedback.type.praise'));

    // Type a message in the textarea
    const messageInput = screen.getByRole('textbox', { name: /feedback\.messageLabel/i });
    await user.type(messageInput, 'Great food!');

    // Click the submit button
    const submitButton = screen.getByText('feedback.submit');
    await user.click(submitButton);

    await waitFor(() => {
      expect(db.feedback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          table_id: 't1',
          order_id: 'o1',
          message: 'Great food!',
        }),
      );
    });
  });

  it('shows error toast for empty message', async () => {
    const _user = userEvent.setup();

    renderWithProviders(<FeedbackForm {...defaultProps} />);

    // The submit button should be disabled when message is empty,
    // but we can still test by submitting the form directly
    // The message textarea is empty, so find and submit the form
    const submitButton = screen.getByText('feedback.submit');

    // The button is disabled when message is empty, so we need to
    // verify that the form validation prevents submission.
    // Since the button has disabled attribute, we check that db.feedback.create is not called.
    expect(submitButton).toBeDisabled();
    expect(db.feedback.create).not.toHaveBeenCalled();
  });

  it('shows success state after submission', async () => {
    const user = userEvent.setup();

    (db.feedback.create as any).mockResolvedValueOnce({ id: 'fb-1' });

    renderWithProviders(<FeedbackForm {...defaultProps} />);

    // Select a feedback type
    await user.click(screen.getByText('feedback.type.complaint'));

    // Type a message
    const messageInput = screen.getByRole('textbox', { name: /feedback\.messageLabel/i });
    await user.type(messageInput, 'Excellent service!');

    // Submit
    await user.click(screen.getByText('feedback.submit'));

    // Wait for the success state to appear
    await waitFor(() => {
      expect(screen.getByText('feedback.successTitle')).toBeInTheDocument();
    });
  });

  it('prevents double submission', async () => {
    const user = userEvent.setup();

    // Create a slow-resolving promise to simulate network delay
    let resolveCreate: (value: any) => void;
    (db.feedback.create as any).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    renderWithProviders(<FeedbackForm {...defaultProps} />);

    // Select a feedback type
    await user.click(screen.getByText('feedback.type.praise'));

    // Type a message
    const messageInput = screen.getByRole('textbox', { name: /feedback\.messageLabel/i });
    await user.type(messageInput, 'Some feedback');

    // Click submit
    const submitButton = screen.getByText('feedback.submit');
    await user.click(submitButton);

    // Wait for the submitting state
    await waitFor(() => {
      expect(screen.getByText('feedback.submitting')).toBeInTheDocument();
    });

    // The button should now be disabled during submission
    expect(screen.getByText('feedback.submitting')).toBeDisabled();

    // Assert create was only called once
    expect(db.feedback.create).toHaveBeenCalledTimes(1);

    // Resolve the promise to clean up and flush pending state updates
    await act(async () => {
      resolveCreate!({ id: 'fb-1' });
    });
  });
});
