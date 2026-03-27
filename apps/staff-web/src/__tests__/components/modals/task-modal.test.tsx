import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockAdminStaff } from '../../helpers/mock-auth';
import { renderWithProviders } from '../../helpers/test-utils';

const mockCreateTask = { mutateAsync: vi.fn().mockResolvedValue({}) };
const mockUpdateTask = { mutateAsync: vi.fn().mockResolvedValue({}) };

vi.mock('@/hooks', () => ({
  useCreateTask: () => mockCreateTask,
  useUpdateTask: () => mockUpdateTask,
  useStaff: () => ({ data: [mockAdminStaff] }),
  useAuth: () => ({ staff: mockAdminStaff }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: any) => <button {...props} />,
}));

import { TaskModal } from '@/components/modals/task-modal';

describe('TaskModal', () => {
  const onClose = vi.fn();

  it('renders "New Task" title for create mode', () => {
    renderWithProviders(<TaskModal onClose={onClose} />);
    const matches = screen.getAllByText('New Task');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Edit Task" title when editing', () => {
    const task = {
      id: 't1',
      title: 'Existing',
      description: null,
      priority: 'normal',
      status: 'pending',
    } as any;
    renderWithProviders(<TaskModal task={task} onClose={onClose} />);
    expect(screen.getByText('Edit Task')).toBeDefined();
  });

  it('shows title input with placeholder', () => {
    renderWithProviders(<TaskModal onClose={onClose} />);
    expect(screen.getByPlaceholderText('What needs to be done?')).toBeDefined();
  });

  it('shows 4 priority buttons', () => {
    renderWithProviders(<TaskModal onClose={onClose} />);
    expect(screen.getByText('Low')).toBeDefined();
    expect(screen.getByText('Normal')).toBeDefined();
    expect(screen.getByText('High')).toBeDefined();
    expect(screen.getByText('Urgent')).toBeDefined();
  });

  it('shows due time as 30-minute interval select', () => {
    renderWithProviders(<TaskModal onClose={onClose} />);
    const selects = screen.getAllByDisplayValue('No time');
    expect(selects.length).toBeGreaterThanOrEqual(1);
  });

  it('shows recurring checkbox for admin', () => {
    renderWithProviders(<TaskModal onClose={onClose} />);
    expect(screen.getByText('Make this a recurring task')).toBeDefined();
  });

  it('calls onClose when Cancel is clicked', () => {
    renderWithProviders(<TaskModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
