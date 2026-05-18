'use client';

import { useEffect } from 'react';
import { useLanguageStore } from '@/store/language-store';

// A2 — RTL markets (Arabic, Persian) are part of the required 20-locale
// matrix. Tailwind's `rtl:` variants only fire when `<html dir="rtl">` is
// set, so toggle it alongside `lang` whenever the language store changes.
const RTL_LANGUAGES: ReadonlySet<string> = new Set(['ar', 'fa']);

export function HtmlLangSetter() {
  const language = useLanguageStore((s) => s.language);
  useEffect(() => {
    const lang = language || 'en';
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr';
  }, [language]);
  return null;
}
