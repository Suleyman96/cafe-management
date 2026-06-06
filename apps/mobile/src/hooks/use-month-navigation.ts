import { useCallback, useState } from 'react';

interface UseMonthNavigationResult {
  /** Currently selected year. */
  year: number;
  /** Currently selected month, 1-based (1 = January, 12 = December). */
  month: number;
  /** Step back one month, wrapping December → previous year. */
  goPrevMonth: () => void;
  /** Step forward one month, wrapping January → next year. */
  goNextMonth: () => void;
  setMonth: (month: number) => void;
  setYear: (year: number) => void;
}

/**
 * Month/year navigation state shared by the month-scoped list screens
 * (expenses, waste). Tracks a 1-based month and wraps the year at the
 * boundaries — identical to the per-screen `handlePrevMonth` /
 * `handleNextMonth` handlers it replaces.
 *
 * Defaults to the current month when no initial values are supplied.
 */
export function useMonthNavigation(
  initialYear?: number,
  initialMonth?: number,
): UseMonthNavigationResult {
  const [year, setYear] = useState(() => initialYear ?? new Date().getFullYear());
  const [month, setMonth] = useState(() => initialMonth ?? new Date().getMonth() + 1);

  const goPrevMonth = useCallback(() => {
    setMonth((m) => {
      if (m === 1) {
        setYear((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  }, []);

  const goNextMonth = useCallback(() => {
    setMonth((m) => {
      if (m === 12) {
        setYear((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  }, []);

  return { year, month, goPrevMonth, goNextMonth, setMonth, setYear };
}
