import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockAdminStaff } from '../../helpers/mock-auth';
import { renderWithProviders } from '../../helpers/test-utils';

const mockCreateExpense = { mutateAsync: vi.fn().mockResolvedValue({}) };
const mockUpdateExpense = { mutateAsync: vi.fn().mockResolvedValue({}) };

const mockCategories = [
  { id: 'c1', name: 'Supplies' },
  { id: 'c2', name: 'Utilities' },
];

vi.mock('@/hooks', () => ({
  useCreateExpense: () => mockCreateExpense,
  useUpdateExpense: () => mockUpdateExpense,
  useExpenseCategories: () => ({ data: mockCategories }),
  useAuth: () => ({ staff: mockAdminStaff }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: any) => <button {...props} />,
}));

import { ExpenseModal } from '@/components/modals/expense-modal';

describe('ExpenseModal', () => {
  const onClose = vi.fn();

  it('renders "Add Expense" title for create mode', () => {
    renderWithProviders(<ExpenseModal onClose={onClose} />);
    const headings = screen.getAllByText('Add Expense');
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Edit Expense" title when editing', () => {
    const expense = {
      id: 'e1',
      amount: 50,
      description: 'Test',
      payment_method: 'cash',
      expense_date: '2026-02-25',
    } as any;
    renderWithProviders(<ExpenseModal expense={expense} onClose={onClose} />);
    expect(screen.getByText('Edit Expense')).toBeDefined();
  });

  it('shows amount input with placeholder', () => {
    renderWithProviders(<ExpenseModal onClose={onClose} />);
    expect(screen.getByPlaceholderText('0.00')).toBeDefined();
  });

  it('shows description input', () => {
    renderWithProviders(<ExpenseModal onClose={onClose} />);
    expect(screen.getByPlaceholderText('What was this expense for?')).toBeDefined();
  });

  it('shows category dropdown with categories', () => {
    renderWithProviders(<ExpenseModal onClose={onClose} />);
    expect(screen.getByText('Supplies')).toBeDefined();
    expect(screen.getByText('Utilities')).toBeDefined();
  });

  it('shows payment method dropdown with Cash selected by default', () => {
    renderWithProviders(<ExpenseModal onClose={onClose} />);
    expect(screen.getByDisplayValue('Cash')).toBeDefined();
  });

  it('calls onClose when Cancel is clicked', () => {
    renderWithProviders(<ExpenseModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
