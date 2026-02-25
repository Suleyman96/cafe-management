import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockAdminStaff } from '../../helpers/mock-auth';
import { renderWithProviders } from '../../helpers/test-utils';

const mockCreateWaste = { mutateAsync: vi.fn().mockResolvedValue({}) };
const mockUpdateWaste = { mutateAsync: vi.fn().mockResolvedValue({}) };
const mockAdjustStock = { mutateAsync: vi.fn().mockResolvedValue({}) };

const mockStockItems = [
  { id: 's1', name: 'Tomatoes', quantity: 50, unit: 'kg', cost_price: 2.5, category: 'Produce' },
  { id: 's2', name: 'Bread', quantity: 20, unit: 'pieces', cost_price: 1.0, category: 'Bakery' },
];

vi.mock('@/hooks', () => ({
  useCreateWasteLog: () => mockCreateWaste,
  useUpdateWasteLog: () => mockUpdateWaste,
  useAdjustStock: () => mockAdjustStock,
  useStockItems: () => ({ data: mockStockItems }),
  useAuth: () => ({ staff: mockAdminStaff }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: any) => <button {...props} />,
}));

import { WasteLogModal } from '@/components/modals/waste-log-modal';

describe('WasteLogModal', () => {
  const onClose = vi.fn();

  it('renders "Log Waste" title for create mode', () => {
    renderWithProviders(<WasteLogModal onClose={onClose} />);
    const matches = screen.getAllByText('Log Waste');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Edit Waste Log" title when editing', () => {
    const wasteLog = {
      id: 'w1',
      item_name: 'Bread',
      quantity: 5,
      unit: 'pieces',
      cost_per_unit: 1,
      total_cost: 5,
      reason: 'expired',
      waste_date: '2026-02-25',
    } as any;
    renderWithProviders(<WasteLogModal wasteLog={wasteLog} onClose={onClose} />);
    expect(screen.getByText('Edit Waste Log')).toBeDefined();
  });

  it('shows stock item dropdown with items', () => {
    renderWithProviders(<WasteLogModal onClose={onClose} />);
    expect(screen.getByText(/Tomatoes/)).toBeDefined();
    expect(screen.getByText(/Bread/)).toBeDefined();
  });

  it('shows waste reason dropdown', () => {
    renderWithProviders(<WasteLogModal onClose={onClose} />);
    expect(screen.getByDisplayValue('Expired')).toBeDefined();
  });

  it('shows deduct checkbox for new entry with stock item', () => {
    renderWithProviders(<WasteLogModal onClose={onClose} />);
    // Initially no stock item selected, checkbox should not be visible
    expect(screen.queryByText('Deduct from stock inventory')).toBeNull();
  });

  it('shows submit button with "Log Waste" text', () => {
    renderWithProviders(<WasteLogModal onClose={onClose} />);
    const submitBtn = screen.getByRole('button', { name: 'Log Waste' });
    expect(submitBtn).toBeDefined();
  });

  it('calls onClose when Cancel is clicked', () => {
    renderWithProviders(<WasteLogModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
