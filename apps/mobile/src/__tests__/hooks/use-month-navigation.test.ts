import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMonthNavigation } from '@/hooks/use-month-navigation';

describe('useMonthNavigation', () => {
  it('defaults to the current month/year', () => {
    const now = new Date();
    const { result } = renderHook(() => useMonthNavigation());
    expect(result.current.year).toBe(now.getFullYear());
    expect(result.current.month).toBe(now.getMonth() + 1);
  });

  it('uses supplied initial values', () => {
    const { result } = renderHook(() => useMonthNavigation(2024, 6));
    expect(result.current.year).toBe(2024);
    expect(result.current.month).toBe(6);
  });

  it('goPrevMonth steps back within a year', () => {
    const { result } = renderHook(() => useMonthNavigation(2024, 6));
    act(() => result.current.goPrevMonth());
    expect(result.current).toMatchObject({ year: 2024, month: 5 });
  });

  it('goPrevMonth wraps January → previous December', () => {
    const { result } = renderHook(() => useMonthNavigation(2024, 1));
    act(() => result.current.goPrevMonth());
    expect(result.current).toMatchObject({ year: 2023, month: 12 });
  });

  it('goNextMonth steps forward within a year', () => {
    const { result } = renderHook(() => useMonthNavigation(2024, 6));
    act(() => result.current.goNextMonth());
    expect(result.current).toMatchObject({ year: 2024, month: 7 });
  });

  it('goNextMonth wraps December → next January', () => {
    const { result } = renderHook(() => useMonthNavigation(2024, 12));
    act(() => result.current.goNextMonth());
    expect(result.current).toMatchObject({ year: 2025, month: 1 });
  });

  it('exposes setMonth / setYear', () => {
    const { result } = renderHook(() => useMonthNavigation(2024, 6));
    act(() => {
      result.current.setMonth(3);
      result.current.setYear(2030);
    });
    expect(result.current).toMatchObject({ year: 2030, month: 3 });
  });
});
