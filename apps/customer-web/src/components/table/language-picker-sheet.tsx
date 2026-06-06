'use client';

import type { Language } from '@gustri/i18n';
import { LANGUAGES, useTranslation } from '@gustri/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { cn } from '@/lib/utils';

interface LanguagePickerSheetProps {
  open: boolean;
  onClose: () => void;
  language: string;
  setLanguage: (lang: Language) => void;
  accentColor: string;
}

export function LanguagePickerSheet({
  open,
  onClose,
  language,
  setLanguage,
  accentColor,
}: LanguagePickerSheetProps) {
  const { t } = useTranslation('customer');
  // A3 — scroll affordance for the 20-locale grid. `hasMoreBelow` drives the
  // bottom gradient so the list visually hints that more languages exist
  // below the fold instead of relying on a hidden scrollbar.
  const langGridRef = useRef<HTMLDivElement | null>(null);
  const langSheetRef = useRef<HTMLDivElement | null>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);

  // A5 — focus trap on the language-picker bottom sheet so keyboard
  // customers (rare on phones, common on tablet menus) don't escape
  // the modal via Tab and lose their place.
  useFocusTrap(langSheetRef, {
    active: open,
    onClose,
  });

  const updateHasMoreBelow = useCallback(() => {
    const el = langGridRef.current;
    if (!el) {
      setHasMoreBelow(false);
      return;
    }
    // 4px tolerance — `scrollTop` and `scrollHeight` can be sub-pixel on
    // zoomed mobile viewports and we don't want the gradient flickering
    // when the user reaches the natural end of the list.
    setHasMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Wait one paint so the sheet's enter animation settles before we
    // measure scroll metrics.
    const id = window.requestAnimationFrame(updateHasMoreBelow);
    return () => window.cancelAnimationFrame(id);
  }, [open, updateHasMoreBelow]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div
        ref={langSheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('tableLanding.languagePickerAria')}
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom duration-300 focus:outline-none"
      >
        <div
          className="rounded-t-3xl px-5 pb-8 pt-3 shadow-2xl"
          style={{
            background: 'linear-gradient(180deg, #1A1A1E, #141416)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />

          {/* A3 — keep scrollbar-hide for the polished aesthetic, but
              layer a fading bottom gradient that disappears once the
              user reaches the end. Without this, customers in
              lower-listed locales (TR, RU, UK, UZ, …) can't see the
              list continues past the first four rows. */}
          <div className="relative">
            <div
              ref={langGridRef}
              onScroll={updateHasMoreBelow}
              className="grid grid-cols-4 gap-1.5 max-h-[50vh] overflow-y-auto scrollbar-hide"
            >
              {LANGUAGES.map((lang) => {
                const isSelected = language === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code as Language);
                      onClose();
                    }}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-2xl py-3 px-2 text-center transition-all active:scale-95',
                      isSelected ? '' : 'hover:bg-white/5',
                    )}
                    style={
                      isSelected
                        ? {
                            backgroundColor: `${accentColor}15`,
                            boxShadow: `inset 0 0 0 1.5px ${accentColor}60`,
                          }
                        : {}
                    }
                  >
                    <span className="text-[22px] leading-none">{lang.flag}</span>
                    <span
                      className={cn(
                        'text-[10px] leading-tight font-medium',
                        isSelected ? '' : 'text-white/40',
                      )}
                      style={isSelected ? { color: accentColor } : {}}
                    >
                      {lang.code.toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
            {hasMoreBelow && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b-2xl"
                style={{
                  background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
                }}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
