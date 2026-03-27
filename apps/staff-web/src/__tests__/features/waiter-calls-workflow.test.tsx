import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/test-utils';

const mockResolveCall = { mutateAsync: vi.fn().mockResolvedValue({}) };

let mockWaiterCalls: any[] | undefined = [];
let mockIsLoading = false;
const mockRefetch = vi.fn();

vi.mock('@/hooks', () => ({
  useWaiterCalls: () => ({
    data: mockWaiterCalls,
    isLoading: mockIsLoading,
    error: null,
    refetch: mockRefetch,
  }),
  useResolveWaiterCall: () => mockResolveCall,
}));

import WaiterCallsPage from '@/app/(staff)/calls/page';

const makePendingCall = (overrides: any = {}) => ({
  id: `call-${Math.random().toString(36).slice(2, 6)}`,
  call_type: 'assistance',
  status: 'pending',
  created_at: new Date(Date.now() - 3 * 60000).toISOString(),
  table: { table_number: 'T7' },
  reason: null,
  message: null,
  responded_at: null,
  staff: null,
  ...overrides,
});

describe('Waiter calls resolution workflow', () => {
  beforeEach(() => {
    mockWaiterCalls = [];
    mockIsLoading = false;
    vi.clearAllMocks();
  });

  it('default filter is pending', () => {
    mockWaiterCalls = [
      makePendingCall({ id: 'c1', status: 'pending' }),
      makePendingCall({ id: 'c2', status: 'completed' }),
    ];
    renderWithProviders(<WaiterCallsPage />);

    // Pending filter button should be active (orange styling)
    // t('pending', { ns: 'common' }) returns 'Pending' from our dict
    const filterButtons = screen.getAllByRole('button');
    const pendingFilter = filterButtons.find(
      (b) => b.textContent === 'Pending' && b.className.includes('rounded-lg'),
    );
    expect(pendingFilter?.className).toContain('bg-orange-100');
  });

  it('pending calls show Respond button', () => {
    mockWaiterCalls = [makePendingCall({ id: 'c1', status: 'pending' })];
    renderWithProviders(<WaiterCallsPage />);

    // t('calls.respond') → 'Respond'
    const buttons = screen.getAllByRole('button');
    const respondBtn = buttons.find((b) => b.textContent?.includes('Respond'));
    expect(respondBtn).toBeDefined();
  });

  it('completed calls do not show Respond button when filtered', () => {
    mockWaiterCalls = [
      makePendingCall({
        id: 'c1',
        status: 'completed',
        responded_at: '2024-01-15T10:00:00Z',
        staff: { name: 'John' },
      }),
    ];
    renderWithProviders(<WaiterCallsPage />);

    // Switch to completed filter
    // t('completed', { ns: 'common' }) → 'Completed'
    const filterButtons = screen.getAllByRole('button');
    const completedFilter = filterButtons.find(
      (b) => b.textContent === 'Completed' && b.className.includes('rounded-lg'),
    );
    fireEvent.click(completedFilter!);

    // The respond button (inside a call card) should NOT be present
    const allButtons = screen.getAllByRole('button');
    const respondInCard = allButtons.find(
      (b) => b.textContent?.includes('Respond') && !b.className.includes('rounded-lg'),
    );
    expect(respondInCard).toBeUndefined();
  });

  it('clicking Respond calls resolve mutation', async () => {
    mockWaiterCalls = [makePendingCall({ id: 'call-abc', status: 'pending' })];
    renderWithProviders(<WaiterCallsPage />);

    const buttons = screen.getAllByRole('button');
    const respondBtn = buttons.find((b) => b.textContent?.includes('Respond'));
    fireEvent.click(respondBtn!);

    await vi.waitFor(() => {
      expect(mockResolveCall.mutateAsync).toHaveBeenCalledWith({
        callId: 'call-abc',
        notes: undefined,
      });
    });
  });

  it('emergency calls have pulse animation when pending', () => {
    mockWaiterCalls = [makePendingCall({ id: 'c1', call_type: 'emergency', status: 'pending' })];
    renderWithProviders(<WaiterCallsPage />);

    // t('calls.emergency') → 'Emergency'
    const emergencyLabel = screen.getByText('Emergency');
    // Walk up to find the card div with animate-pulse
    const card = emergencyLabel.closest('.animate-pulse');
    expect(card).not.toBeNull();
  });

  it('shows empty state when no calls match filter', () => {
    mockWaiterCalls = [];
    renderWithProviders(<WaiterCallsPage />);

    // t('calls.noCalls') → 'No calls'
    expect(screen.getByText('No calls')).toBeDefined();
  });

  it('time formatting shows relative time', () => {
    mockWaiterCalls = [
      makePendingCall({
        id: 'c1',
        status: 'pending',
        created_at: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
      }),
    ];
    renderWithProviders(<WaiterCallsPage />);

    // t('calls.justNow') → 'Just now'
    expect(screen.getByText('Just now')).toBeDefined();
  });
});
