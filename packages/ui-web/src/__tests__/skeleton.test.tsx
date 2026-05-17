import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from '../skeleton';

describe('Skeleton', () => {
  it('renders a pulsing rounded-md gray box by default', () => {
    const { container } = render(<Skeleton />);
    const node = container.firstElementChild as HTMLDivElement | null;
    expect(node).not.toBeNull();
    expect(node?.className).toContain('animate-pulse');
    expect(node?.className).toContain('rounded-md');
    expect(node?.className).toContain('bg-gray-200');
  });

  it('forwards a custom className alongside the defaults', () => {
    const { container } = render(<Skeleton className="h-6 w-20" />);
    const node = container.firstElementChild as HTMLDivElement | null;
    expect(node?.className).toContain('animate-pulse');
    expect(node?.className).toContain('h-6');
    expect(node?.className).toContain('w-20');
  });
});
