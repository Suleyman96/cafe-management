import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GustriIcon, GustriLogo } from '../gustri-logo';

describe('GustriLogo', () => {
  it('renders the wordmark by default', () => {
    render(<GustriLogo />);
    expect(screen.getByText('gustri')).toBeDefined();
  });

  it('hides wordmark when showText is false', () => {
    render(<GustriLogo showText={false} />);
    expect(screen.queryByText('gustri')).toBeNull();
  });

  it('renders icon at custom size', () => {
    const { container } = render(<GustriLogo size={64} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('64');
    expect(svg?.getAttribute('height')).toBe('64');
  });

  it.each(['color', 'dark', 'light'] as const)('renders %s variant', (variant) => {
    const { container } = render(<GustriLogo variant={variant} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('GustriIcon', () => {
  it('renders an SVG with role=img and accessible label', () => {
    render(<GustriIcon />);
    const img = screen.getByRole('img', { name: /gustri logo/i });
    expect(img).toBeDefined();
  });

  it('respects custom size', () => {
    const { container } = render(<GustriIcon size={48} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('48');
  });

  it('omits background rect for non-color variants', () => {
    const { container: dark } = render(<GustriIcon variant="dark" />);
    const { container: color } = render(<GustriIcon variant="color" />);
    expect(dark.querySelector('rect')).toBeNull();
    expect(color.querySelector('rect')).not.toBeNull();
  });
});
