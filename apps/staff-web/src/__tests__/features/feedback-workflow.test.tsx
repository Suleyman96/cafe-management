import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/test-utils';

const mockMarkFeedbackRead = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };

let mockFeedbackData: any[] | undefined = [];
let mockIsLoading = false;

vi.mock('@/hooks', () => ({
  useFeedback: () => ({ data: mockFeedbackData, isLoading: mockIsLoading }),
  usePendingFeedbackCount: () => ({ data: 3 }),
  useMarkFeedbackRead: () => mockMarkFeedbackRead,
  getFeedbackTypeInfo: (type: string) => {
    const types: Record<string, any> = {
      complaint: { icon: '😟', label: 'Complaint', color: 'red' },
      praise: { icon: '😊', label: 'Praise', color: 'green' },
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
  feedback_type: 'complaint',
  message: 'My soup was cold',
  status: 'pending',
  created_at: '2024-01-15T10:00:00Z',
  table: { table_number: 'T5' },
};

const readFeedback = {
  id: 'fb-2',
  feedback_type: 'praise',
  message: 'Wonderful experience',
  status: 'acknowledged',
  created_at: '2024-01-15T09:00:00Z',
  table: { table_number: 'T3' },
};

describe('Feedback management workflow', () => {
  beforeEach(() => {
    mockFeedbackData = [pendingFeedback];
    mockIsLoading = false;
  });

  it('shows unread tab by default with pending count badge', () => {
    renderWithProviders(<FeedbackPage />);
    expect(screen.getByText('3')).toBeDefined();
  });

  it('pending feedback shows Mark as Read button', () => {
    renderWithProviders(<FeedbackPage />);
    const buttons = screen.getAllByRole('button');
    const buttonTexts = buttons.map((b) => b.textContent);
    expect(buttonTexts.some((t) => t?.includes('Mark as Read'))).toBe(true);
  });

  it('status badges show translated text', () => {
    mockFeedbackData = [pendingFeedback, readFeedback];
    renderWithProviders(<FeedbackPage />);
    // "Unread" appears in both the tab and the status badge
    expect(screen.getAllByText('Unread').length).toBeGreaterThanOrEqual(2);
    // "Read" appears in both the tab and the status badge
    expect(screen.getAllByText('Read').length).toBeGreaterThanOrEqual(2);
  });

  it('shows loading spinner when loading', () => {
    mockIsLoading = true;
    mockFeedbackData = undefined;
    renderWithProviders(<FeedbackPage />);
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('shows empty state when no feedback', () => {
    mockFeedbackData = [];
    renderWithProviders(<FeedbackPage />);
    expect(screen.getByText('No feedback to display')).toBeDefined();
  });
});
