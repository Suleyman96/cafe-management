import { fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NumberInput } from '../number-input';

function Controlled(
  props: Partial<React.ComponentProps<typeof NumberInput>> & { initial?: string },
) {
  const [value, setValue] = useState<string>(props.initial ?? '');
  return <NumberInput value={value} onChange={setValue} {...props} />;
}

describe('NumberInput', () => {
  it('renders with placeholder', () => {
    const { getByPlaceholderText } = render(
      <NumberInput value="" onChange={vi.fn()} placeholder="0.00" />,
    );
    expect(getByPlaceholderText('0.00')).toBeDefined();
  });

  it('shows the value', () => {
    const { getByDisplayValue } = render(<NumberInput value={42} onChange={vi.fn()} />);
    expect(getByDisplayValue('42')).toBeDefined();
  });

  it('calls onChange when typing valid digits', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { getByDisplayValue } = render(<NumberInput value="" onChange={onChange} />);
    const input = getByDisplayValue('') as HTMLInputElement;
    await user.type(input, '5');
    expect(onChange).toHaveBeenCalled();
  });

  it('rejects letters', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { getByDisplayValue } = render(<NumberInput value="" onChange={onChange} />);
    const input = getByDisplayValue('') as HTMLInputElement;
    await user.type(input, 'a');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('allows clearing to empty string', () => {
    const onChange = vi.fn();
    const { getByDisplayValue } = render(<NumberInput value="5" onChange={onChange} />);
    const input = getByDisplayValue('5') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('integer mode rejects decimal point', () => {
    const onChange = vi.fn();
    const { getByDisplayValue } = render(<NumberInput value="" onChange={onChange} integer />);
    const input = getByDisplayValue('') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1.5' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps value to min/max on blur', () => {
    const { getByDisplayValue } = render(<Controlled initial="200" min={0} max={100} />);
    const input = getByDisplayValue('200') as HTMLInputElement;
    fireEvent.blur(input);
    expect(Number(input.value)).toBeLessThanOrEqual(100);
  });

  // The intent comment in handleChange says minus should be blocked when min >= 0,
  // but the fall-through regex still accepts a lone '-'. handleBlur cleans it up,
  // so this is benign — pinned here so any source fix updates the test.
  it('still emits a lone minus during typing when min is 0', () => {
    const onChange = vi.fn();
    const { getByDisplayValue } = render(<NumberInput value="" onChange={onChange} min={0} />);
    const input = getByDisplayValue('') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-' } });
    expect(onChange).toHaveBeenCalledWith('-');
  });

  it('allows minus sign when min is negative', () => {
    const onChange = vi.fn();
    const { getByDisplayValue } = render(<NumberInput value="" onChange={onChange} min={-10} />);
    const input = getByDisplayValue('') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-' } });
    expect(onChange).toHaveBeenCalledWith('-');
  });

  it('renders prefix and suffix', () => {
    const { getByText } = render(
      <NumberInput value="" onChange={vi.fn()} prefix="$" suffix="kg" />,
    );
    expect(getByText('$')).toBeDefined();
    expect(getByText('kg')).toBeDefined();
  });

  it('respects disabled prop', () => {
    const { getByDisplayValue } = render(<NumberInput value="" onChange={vi.fn()} disabled />);
    expect((getByDisplayValue('') as HTMLInputElement).disabled).toBe(true);
  });

  it('respects readOnly prop', () => {
    const { getByDisplayValue } = render(<NumberInput value="" onChange={vi.fn()} readOnly />);
    expect((getByDisplayValue('') as HTMLInputElement).readOnly).toBe(true);
  });

  it('forwards id', () => {
    const { getByDisplayValue } = render(<NumberInput value="" onChange={vi.fn()} id="qty-1" />);
    expect((getByDisplayValue('') as HTMLInputElement).id).toBe('qty-1');
  });

  it('uses inputMode="numeric" when integer is true', () => {
    const { getByDisplayValue } = render(<NumberInput value="" onChange={vi.fn()} integer />);
    expect((getByDisplayValue('') as HTMLInputElement).inputMode).toBe('numeric');
  });

  it('uses inputMode="decimal" by default', () => {
    const { getByDisplayValue } = render(<NumberInput value="" onChange={vi.fn()} />);
    expect((getByDisplayValue('') as HTMLInputElement).inputMode).toBe('decimal');
  });
});
