import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingSpinner } from '../loading-spinner';

describe('LoadingSpinner', () => {
  it('renders without crashing with default props', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it.each([
    ['sm', 'h-4'],
    ['md', 'h-8'],
    ['lg', 'h-12'],
  ] as const)('renders %s size', (size, expected) => {
    const { container } = render(<LoadingSpinner size={size} />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner?.className).toContain(expected);
  });

  it('forwards custom className', () => {
    const { container } = render(<LoadingSpinner className="custom-class" />);
    expect(container.querySelector('.custom-class')).not.toBeNull();
  });

  it('wraps with full-screen container when fullScreen is true', () => {
    const { container } = render(<LoadingSpinner fullScreen />);
    expect(container.querySelector('.min-h-screen')).not.toBeNull();
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('does not wrap when fullScreen is false', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('.min-h-screen')).toBeNull();
  });
});
