import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge, badgeVariants } from '../badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeDefined();
  });

  it('renders default variant classes', () => {
    render(<Badge data-testid="b">Default</Badge>);
    const badge = screen.getByTestId('b');
    expect(badge.className).toContain('bg-primary');
  });

  it.each([
    ['secondary', 'bg-secondary'],
    ['destructive', 'bg-destructive'],
    ['success', 'bg-green-500'],
    ['warning', 'bg-yellow-500'],
    ['outline', 'text-foreground'],
  ] as const)('renders %s variant', (variant, expected) => {
    render(
      <Badge variant={variant} data-testid="b">
        {variant}
      </Badge>,
    );
    expect(screen.getByTestId('b').className).toContain(expected);
  });

  it('forwards arbitrary HTML attributes', () => {
    render(
      <Badge id="my-badge" data-testid="b">
        Test
      </Badge>,
    );
    const badge = screen.getByTestId('b');
    expect(badge.id).toBe('my-badge');
  });

  it('applies user-supplied className', () => {
    render(
      <Badge className="extra-class" data-testid="b">
        X
      </Badge>,
    );
    expect(screen.getByTestId('b').className).toContain('extra-class');
  });
});

describe('badgeVariants', () => {
  it('returns a string of classes', () => {
    expect(typeof badgeVariants()).toBe('string');
  });

  it('returns variant-specific classes', () => {
    expect(badgeVariants({ variant: 'success' })).toContain('bg-green-500');
  });
});
