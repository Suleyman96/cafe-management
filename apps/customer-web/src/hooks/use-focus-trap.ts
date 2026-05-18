'use client';

import { type RefObject, useEffect } from 'react';

// A5 — Bespoke focus trap for the customer-web modals (cancel-order,
// cancel-item, menu-item, language picker). Adopting Radix Dialog would
// require restructuring those overlays; this hook keeps the existing
// `fixed inset-0` JSX in place and adds keyboard semantics on top:
//   • Records the trigger element on mount and restores focus on close.
//   • Focuses the first focusable element inside the container.
//   • Tab / Shift+Tab cycle within the container.
//   • Escape calls onClose.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface UseFocusTrapOptions {
  active: boolean;
  onClose?: () => void;
}

export function useFocusTrap<T extends HTMLElement>(
  ref: RefObject<T>,
  { active, onClose }: UseFocusTrapOptions,
) {
  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
      );

    // Defer the initial focus so it lands after the open animation paints.
    const focusTimer = window.setTimeout(() => {
      const focusable = getFocusable();
      (focusable[0] ?? container).focus({ preventScroll: true });
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else {
        if (activeEl === last) {
          event.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown, true);
      // Restore focus to the trigger so keyboard users land where they were.
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active, onClose, ref]);
}
