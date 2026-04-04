import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/test-utils';

const mockAcknowledgeCall = { mutateAsync: vi.fn().mockResolvedValue({}) };
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
  useAcknowledgeWaiterCall: () => mockAcknowledgeCall,
  useResolveWaiterCall: () => mockResolveCall,
  useAuth: () => ({ staff: { id: 'staff-1', full_name: 'Test Staff' } }),
}));

import WaiterCallsPage from '@/app/(staff)/calls/page';

const makePendingCall = (overrides: any = {}) => ({
  id: `call-${Math.random().toString(36).slice(2, 6)}`,
  call_type: 'assistance',
  status: 'pending',
  created_at: new Date(Date.now() - 3 * 60000).toISOString(),
  table: { table_number: 'T7' },
  reason: null,
  notes: null,
  acknowledged_at: null,
  resolved_at: null,
  responded_by: null,
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
      makePendingCall({ id: 'c2', status: 'resolved' }),
    ];
    renderWithProviders(<WaiterCallsPage />);

    const filterButtons = screen.getAllByRole('button');
    const pendingFilter = filterButtons.find(
      (b) => b.textContent === 'Pending' && b.className.includes('rounded-lg'),
    );
    expect(pendingFilter?.className).toContain('bg-orange-100');
  });

  it('pending calls show Acknowledge and Resolve buttons', () => {
    mockWaiterCalls = [makePendingCall({ id: 'c1', status: 'pending' })];
    renderWithProviders(<WaiterCallsPage />);

    const buttons = screen.getAllByRole('button');
    const acknowledgeBtn = buttons.find((b) => b.textContent?.includes('Acknowledge'));
    const resolveBtn = buttons.find((b) => b.textContent?.includes('Resolve'));
    expect(acknowledgeBtn).toBeDefined();
    expect(resolveBtn).toBeDefined();
  });

  it('resolved calls do not show action buttons when filtered', () => {
    mockWaiterCalls = [
      makePendingCall({
        id: 'c1',
        status: 'resolved',
        resolved_at: '2024-01-15T10:00:00Z',
      }),
    ];
    renderWithProviders(<WaiterCallsPage />);

    // Switch to resolved filter
    const filterButtons = screen.getAllByRole('button');
    const resolvedFilter = filterButtons.find(
      (b) => b.textContent === 'Resolved' && b.className.includes('rounded-lg'),
    );
    fireEvent.click(resolvedFilter!);

    const allButtons = screen.getAllByRole('button');
    const acknowledgeInCard = allButtons.find(
      (b) => b.textContent?.includes('Acknowledge') && !b.className.includes('rounded-lg'),
    );
    const resolveInCard = allButtons.find(
      (b) => b.textContent?.includes('Resolve') && !b.className.includes('rounded-lg'),
    );
    expect(acknowledgeInCard).toBeUndefined();
    expect(resolveInCard).toBeUndefined();
  });

  it('clicking Acknowledge calls acknowledge mutation', async () => {
    mockWaiterCalls = [makePendingCall({ id: 'call-abc', status: 'pending' })];
    renderWithProviders(<WaiterCallsPage />);

    const buttons = screen.getAllByRole('button');
    // Exact match to avoid hitting the "Acknowledged" filter button
    const acknowledgeBtn = buttons.find(
      (b) => b.textContent === 'Acknowledge' && !b.className.includes('rounded-lg'),
    );
    fireEvent.click(acknowledgeBtn!);

    await vi.waitFor(() => {
      expect(mockAcknowledgeCall.mutateAsync).toHaveBeenCalledWith({
        callId: 'call-abc',
        staffId: 'staff-1',
      });
    });
  });

  it('clicking Resolve calls resolve mutation', async () => {
    mockWaiterCalls = [makePendingCall({ id: 'call-def', status: 'pending' })];
    renderWithProviders(<WaiterCallsPage />);

    const buttons = screen.getAllByRole('button');
    // Exact match to avoid hitting the "Resolved" filter button
    const resolveBtn = buttons.find(
      (b) => b.textContent === 'Resolve' && !b.className.includes('rounded-lg'),
    );
    fireEvent.click(resolveBtn!);

    await vi.waitFor(() => {
      expect(mockResolveCall.mutateAsync).toHaveBeenCalledWith({
        callId: 'call-def',
      });
    });
  });

  it('acknowledged calls show only Resolve button', () => {
    mockWaiterCalls = [
      makePendingCall({
        id: 'c1',
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
      }),
    ];
    renderWithProviders(<WaiterCallsPage />);

    // Switch to acknowledged filter
    const filterButtons = screen.getAllByRole('button');
    const acknowledgedFilter = filterButtons.find(
      (b) => b.textContent === 'Acknowledged' && b.className.includes('rounded-lg'),
    );
    fireEvent.click(acknowledgedFilter!);

    const allButtons = screen.getAllByRole('button');
    const acknowledgeBtn = allButtons.find(
      (b) => b.textContent?.includes('Acknowledge') && !b.className.includes('rounded-lg'),
    );
    const resolveBtn = allButtons.find(
      (b) => b.textContent?.includes('Resolve') && !b.className.includes('rounded-lg'),
    );
    expect(acknowledgeBtn).toBeUndefined();
    expect(resolveBtn).toBeDefined();
  });

  it('emergency calls have pulse animation when pending', () => {
    mockWaiterCalls = [makePendingCall({ id: 'c1', call_type: 'emergency', status: 'pending' })];
    renderWithProviders(<WaiterCallsPage />);

    const emergencyLabel = screen.getByText('Emergency');
    const card = emergencyLabel.closest('.animate-pulse');
    expect(card).not.toBeNull();
  });

  it('shows empty state when no calls match filter', () => {
    mockWaiterCalls = [];
    renderWithProviders(<WaiterCallsPage />);

    expect(screen.getByText('No calls')).toBeDefined();
  });

  it('time formatting shows relative time', () => {
    mockWaiterCalls = [
      makePendingCall({
        id: 'c1',
        status: 'pending',
        created_at: new Date(Date.now() - 30000).toISOString(),
      }),
    ];
    renderWithProviders(<WaiterCallsPage />);

    expect(screen.getByText('Just now')).toBeDefined();
  });
});
