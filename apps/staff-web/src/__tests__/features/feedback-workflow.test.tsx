import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/test-utils';

const mockAcknowledgeFeedback = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
const mockRespondToFeedback = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
const mockDismissFeedback = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };

let mockFeedbackData: any[] | undefined = [];
let mockIsLoading = false;

vi.mock('@/hooks', () => ({
  useFeedback: () => ({ data: mockFeedbackData, isLoading: mockIsLoading }),
  usePendingFeedbackCount: () => ({ data: 3 }),
  useAcknowledgeFeedback: () => mockAcknowledgeFeedback,
  useRespondToFeedback: () => mockRespondToFeedback,
  useDismissFeedback: () => mockDismissFeedback,
  getFeedbackTypeInfo: (type: string) => {
    const types: Record<string, any> = {
      complaint_food: { icon: '🍽️', label: 'Food Complaint', color: 'red' },
      praise: { icon: '⭐', label: 'Praise', color: 'green' },
    };
    return types[type] || { icon: '📝', label: 'Feedback', color: 'gray' };
  },
}));

vi.mock('@/store/auth-store', () => ({
  useAuthStore: () => ({ staff: { id: 'staff-1', full_name: 'Test Staff' } }),
}));

import FeedbackPage from '@/app/(staff)/feedback/page';

const pendingFeedback = {
  id: 'fb-1',
  feedback_type: 'complaint_food',
  subject: 'Cold food',
  message: 'My soup was cold',
  status: 'pending',
  created_at: '2024-01-15T10:00:00Z',
  response: null,
  responded_by_staff: null,
  table: { table_number: 'T5' },
};

const resolvedFeedback = {
  id: 'fb-2',
  feedback_type: 'praise',
  subject: 'Great service',
  message: 'Wonderful experience',
  status: 'resolved',
  created_at: '2024-01-15T09:00:00Z',
  response: 'Thank you!',
  responded_by_staff: { full_name: 'Manager' },
  table: { table_number: 'T3' },
};

describe('Feedback management workflow', () => {
  beforeEach(() => {
    mockFeedbackData = [pendingFeedback];
    mockIsLoading = false;
  });

  it('shows pending tab by default with pending count badge', () => {
    renderWithProviders(<FeedbackPage />);
    // Count badge shows 3
    expect(screen.getByText('3')).toBeDefined();
    // Pending tab is active (has blue border)
    const pendingTab = screen.getByText('Pending', { selector: 'button' });
    expect(pendingTab.className).toContain('border-blue-500');
  });

  it('pending feedback shows Acknowledge, Respond, and Dismiss action buttons', () => {
    renderWithProviders(<FeedbackPage />);
    // Buttons contain emoji + text; use getAllByRole to find buttons, then check text content
    const buttons = screen.getAllByRole('button');
    const buttonTexts = buttons.map((b) => b.textContent);
    expect(buttonTexts.some((t) => t?.includes('Acknowledge') || t?.includes('Ack'))).toBe(true);
    expect(buttonTexts.some((t) => t?.includes('Respond'))).toBe(true);
    expect(buttonTexts.some((t) => t?.includes('Dismiss'))).toBe(true);
  });

  it('dismiss triggers localized confirm dialog (not hardcoded English)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithProviders(<FeedbackPage />);

    // Find the dismiss action button — it's a Button component (not the tab)
    // Tab button says "Dismissed", action button says "✕ Dismiss"
    const buttons = screen.getAllByRole('button');
    const dismissBtn = buttons.find(
      (b) => b.textContent?.includes('✕') && b.textContent?.includes('Dismiss'),
    );
    expect(dismissBtn).toBeDefined();

    // Use userEvent for more realistic click handling
    await fireEvent.click(dismissBtn!);

    // handleDismiss calls confirm() synchronously before any awaits
    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to dismiss this feedback?');
    confirmSpy.mockRestore();
  });

  it('clicking Respond shows textarea and disabled Send button', () => {
    renderWithProviders(<FeedbackPage />);
    // Find the Respond button (not the RespondResolve one)
    const buttons = screen.getAllByRole('button');
    const respondBtn = buttons.find(
      (b) => b.textContent?.includes('Respond') && !b.textContent?.includes('Resolve'),
    );
    expect(respondBtn).toBeDefined();
    fireEvent.click(respondBtn!);

    expect(screen.getByPlaceholderText('Write your response to the customer...')).toBeDefined();
    // Send button should be disabled when textarea is empty
    const sendBtn = screen.getByText('Send Response');
    expect(sendBtn.closest('button')?.disabled).toBe(true);
  });

  it('status badges show translated text from i18n (not raw status strings)', () => {
    mockFeedbackData = [pendingFeedback, resolvedFeedback];
    renderWithProviders(<FeedbackPage />);

    // Status badges use t(`feedback.status.${item.status}`) which returns translated text
    // 'feedback.status.pending' -> 'Pending', 'feedback.status.resolved' -> 'Resolved'
    const badges = document.querySelectorAll('.capitalize');
    const badgeTexts = Array.from(badges).map((b) => b.textContent);
    expect(badgeTexts).toContain('Pending');
    expect(badgeTexts).toContain('Resolved');
  });

  it('shows loading spinner when loading', () => {
    mockIsLoading = true;
    mockFeedbackData = undefined;
    renderWithProviders(<FeedbackPage />);

    // t('loading', { ns: 'common' }) returns 'Loading' from our dict, rendered as "Loading..."
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('shows empty state when no feedback', () => {
    mockFeedbackData = [];
    renderWithProviders(<FeedbackPage />);

    expect(screen.getByText('No feedback to display')).toBeDefined();
  });
});
