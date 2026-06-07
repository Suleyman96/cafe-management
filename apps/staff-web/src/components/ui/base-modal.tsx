'use client';

import { useTranslation } from '@gustri/i18n';
import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl';

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
};

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  as?: 'div' | 'form';
  onSubmit?: (e: React.FormEvent) => void;
}

export function BaseModal({
  isOpen,
  onClose,
  title,
  icon,
  size = 'lg',
  children,
  footer,
  as = 'div',
  onSubmit,
}: BaseModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // a11y: while open, trap Tab focus inside the dialog, focus the first control,
  // close on Escape, and restore focus to the trigger on close. Mirrors the
  // customer-web `useFocusTrap` behavior; kept inline so BaseModal stays a
  // self-contained primitive. Guarded on `isOpen` so the hook order is stable
  // (the early `return null` below sits after all hooks).
  useEffect(() => {
    if (!isOpen) return;
    const container = dialogRef.current;
    if (!container) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
      );

    const focusTimer = window.setTimeout(() => {
      (getFocusable()[0] ?? container).focus({ preventScroll: true });
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
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
      } else if (activeEl === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown, true);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const Wrapper = as;
  const wrapperProps = as === 'form' ? { onSubmit } : {};

  return (
    // `h-dvh` (and `max-h-[90dvh]` on the inner box) — `100vh` resolves to
    // the URL-bar-collapsed value on iOS Safari, so a `fixed inset-0`
    // backdrop is taller than the actually visible viewport and centering
    // inside it places the modal bottom (with the Submit button) behind the
    // URL bar. `dvh` tracks the visible viewport so the modal stays within
    // reach on mobile. Desktop behavior is unchanged.
    <div className="fixed inset-x-0 top-0 h-dvh bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'bg-white rounded-lg shadow-xl w-full max-h-[90dvh] overflow-hidden flex flex-col outline-none',
          sizeClasses[size],
        )}
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {icon}
            <h2 id={titleId} className="text-xl font-bold text-gray-900">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            type="button"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <Wrapper {...wrapperProps} className="flex-1 flex flex-col min-h-0">
          {/* Scroll boundary lives on the body, not the wrapper, so the footer
              sits below the scroll area and stays pinned to the modal bottom
              on small viewports. Keeping the footer inside `<Wrapper>` (rather
              than as a sibling) preserves form submission for `as='form'`
              modals — the submit button stays inside the form. */}
          <div className="flex-1 overflow-y-auto p-6">{children}</div>

          {footer && (
            <div className="border-t px-6 py-4 flex flex-col sm:flex-row gap-3 shrink-0">
              {footer}
            </div>
          )}
        </Wrapper>
      </div>
    </div>
  );
}
