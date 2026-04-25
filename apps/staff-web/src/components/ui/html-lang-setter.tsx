'use client';

import { useTranslation } from '@gustri/i18n';
import { useEffect } from 'react';

export function HtmlLangSetter() {
  const { i18n } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = i18n.language || 'en';
  }, [i18n.language]);
  return null;
}
