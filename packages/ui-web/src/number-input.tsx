'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface NumberInputProps {
  value: string | number;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  className?: string;
  /** Use integer-only input mode */
  integer?: boolean;
  id?: string;
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder = '0',
  prefix,
  suffix,
  disabled = false,
  readOnly = false,
  required = false,
  className = '',
  integer = false,
  id,
}: NumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const stringValue = String(value ?? '');

  const clamp = useCallback(
    (num: number): number => {
      let result = num;
      if (min !== undefined) result = Math.max(min, result);
      if (max !== undefined) result = Math.min(max, result);
      return result;
    },
    [min, max],
  );

  const roundToStep = useCallback(
    (num: number): number => {
      const decimals = (step.toString().split('.')[1] || '').length;
      return Number(num.toFixed(decimals));
    },
    [step],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      // Allow empty string for clearing
      if (raw === '') {
        onChange('');
        return;
      }

      // Allow minus sign only if min is negative or undefined
      if (raw === '-' && (min === undefined || min < 0)) {
        onChange('-');
        return;
      }

      // Validate the input pattern
      const pattern = integer ? /^-?\d*$/ : /^-?\d*\.?\d*$/;
      if (!pattern.test(raw)) return;

      onChange(raw);
    },
    [onChange, min, integer],
  );

  const handleBlur = useCallback(() => {
    setIsFocused(false);

    // Clean up the value on blur
    if (stringValue === '' || stringValue === '-') return;

    const parsed = parseFloat(stringValue);
    if (Number.isNaN(parsed)) {
      onChange('');
      return;
    }

    const clamped = clamp(parsed);
    const rounded = roundToStep(clamped);
    if (String(rounded) !== stringValue) {
      onChange(String(rounded));
    }
  }, [stringValue, clamp, roundToStep, onChange]);

  // Prevent scroll from changing the value
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const preventScroll = (e: WheelEvent) => {
      if (document.activeElement === el) {
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', preventScroll, { passive: false });
    return () => el.removeEventListener('wheel', preventScroll);
  }, []);

  return (
    <div
      className={`relative flex items-center border rounded-lg transition-colors ${
        isFocused ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300'
      } ${disabled ? 'bg-gray-100 opacity-60' : readOnly ? 'bg-gray-50' : 'bg-white'} ${className}`}
    >
      {/* Prefix */}
      {prefix && (
        <span className="text-gray-500 text-sm pl-3 pr-1 shrink-0 select-none">{prefix}</span>
      )}

      {/* Input */}
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        value={stringValue}
        onChange={handleChange}
        onFocus={(e) => {
          setIsFocused(true);
          e.target.select();
        }}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        className={`w-full py-2 bg-transparent outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
          prefix ? 'pl-1' : 'pl-3'
        } ${suffix ? 'pr-2' : 'pr-3'}`}
      />

      {/* Suffix */}
      {suffix && <span className="text-gray-500 text-sm pr-3 shrink-0 select-none">{suffix}</span>}
    </div>
  );
}
