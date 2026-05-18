import { useEffect, useState } from 'react';

/**
 * P3 — trailing-edge debounce for a derived value. The input stays
 * controlled with the raw value (so typing feels responsive); only the
 * downstream consumer sees the debounced one. Used by the menu search
 * filter to skip re-running `getLocalizedField` on every keystroke on
 * 200-item menus where the cost shows up on cheap-Android profilers.
 */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
