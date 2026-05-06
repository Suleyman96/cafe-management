import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE } from './languages';

export type I18nNamespace = 'common' | 'nav' | 'auth' | 'staff' | 'customer' | 'roles' | 'errors';

export interface InitI18nOptions {
  lng?: string;
  namespaces?: I18nNamespace[];
  resources?: Record<string, Record<string, Record<string, string>>>;
}

export function initI18n(options?: InitI18nOptions) {
  const ns = options?.namespaces || ['common'];

  return i18n.use(initReactI18next).init({
    lng: options?.lng || DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    ns,
    defaultNS: 'common',
    keySeparator: false,
    interpolation: {
      escapeValue: false,
    },
    resources: options?.resources || {},
  });
}

export { i18n };
