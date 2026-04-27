import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { Button, buttonVariants } from '../button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeDefined();
  });

  it('forwards type, disabled, and other native props', () => {
    render(
      <Button type="submit" disabled>
        Submit
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Submit' }) as HTMLButtonElement;
    expect(btn.type).toBe('submit');
    expect(btn.disabled).toBe(true);
  });

  it('forwards refs', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Test</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('applies className alongside variant classes', () => {
    render(<Button className="custom-extra">X</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('custom-extra');
  });

  it('renders default variant + size classes', () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole('button');
    // default variant uses bg-primary; default size uses h-10
    expect(btn.className).toContain('bg-primary');
    expect(btn.className).toContain('h-10');
  });

  it.each([
    ['destructive', 'bg-destructive'],
    ['outline', 'border'],
    ['secondary', 'bg-secondary'],
    ['ghost', 'hover:bg-accent'],
    ['link', 'underline-offset-4'],
  ] as const)('renders %s variant', (variant, expected) => {
    render(<Button variant={variant}>{variant}</Button>);
    expect(screen.getByRole('button').className).toContain(expected);
  });

  it.each([
    ['sm', 'h-9'],
    ['lg', 'h-12'],
    ['xl', 'h-14'],
    ['icon', 'w-10'],
  ] as const)('renders %s size', (size, expected) => {
    render(<Button size={size}>{size}</Button>);
    expect(screen.getByRole('button').className).toContain(expected);
  });

  it('handles onClick events', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    let clicked = false;
    render(<Button onClick={() => (clicked = true)}>Go</Button>);
    await user.click(screen.getByRole('button'));
    expect(clicked).toBe(true);
  });
});

describe('buttonVariants', () => {
  it('returns a string of classes', () => {
    expect(typeof buttonVariants()).toBe('string');
  });

  it('reflects variant overrides', () => {
    expect(buttonVariants({ variant: 'destructive' })).toContain('bg-destructive');
    expect(buttonVariants({ size: 'lg' })).toContain('h-12');
  });
});
