'use client';

import { useEffect } from 'react';
import { useLanguageStore } from '@/store/language-store';

export function HtmlLangSetter() {
  const language = useLanguageStore((s) => s.language);
  useEffect(() => {
    document.documentElement.lang = language || 'en';
  }, [language]);
  return null;
}
