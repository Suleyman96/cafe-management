'use client';

import { i18n, initI18n } from '@gustri/i18n';
import commonJa from '@gustri/i18n/locales/ja/common.json';
import customerJa from '@gustri/i18n/locales/ja/customer.json';
import errorsJa from '@gustri/i18n/locales/ja/errors.json';

initI18n({
  lng: 'ja',
  namespaces: ['common', 'customer', 'errors'],
  resources: {
    ja: {
      common: commonJa,
      customer: customerJa,
      errors: errorsJa,
    },
  },
});

type NamespaceBundles = {
  common: Record<string, unknown>;
  customer: Record<string, unknown>;
  errors: Record<string, unknown>;
};

// Static import map — webpack can resolve each path at build time
const languageLoaders: Record<string, () => Promise<NamespaceBundles>> = {
  en: async () => ({
    common: (await import('@gustri/i18n/locales/en/common.json')).default,
    customer: (await import('@gustri/i18n/locales/en/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/en/errors.json')).default,
  }),
  az: async () => ({
    common: (await import('@gustri/i18n/locales/az/common.json')).default,
    customer: (await import('@gustri/i18n/locales/az/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/az/errors.json')).default,
  }),
  ru: async () => ({
    common: (await import('@gustri/i18n/locales/ru/common.json')).default,
    customer: (await import('@gustri/i18n/locales/ru/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/ru/errors.json')).default,
  }),
  tr: async () => ({
    common: (await import('@gustri/i18n/locales/tr/common.json')).default,
    customer: (await import('@gustri/i18n/locales/tr/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/tr/errors.json')).default,
  }),
  ka: async () => ({
    common: (await import('@gustri/i18n/locales/ka/common.json')).default,
    customer: (await import('@gustri/i18n/locales/ka/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/ka/errors.json')).default,
  }),
  kk: async () => ({
    common: (await import('@gustri/i18n/locales/kk/common.json')).default,
    customer: (await import('@gustri/i18n/locales/kk/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/kk/errors.json')).default,
  }),
  uz: async () => ({
    common: (await import('@gustri/i18n/locales/uz/common.json')).default,
    customer: (await import('@gustri/i18n/locales/uz/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/uz/errors.json')).default,
  }),
  de: async () => ({
    common: (await import('@gustri/i18n/locales/de/common.json')).default,
    customer: (await import('@gustri/i18n/locales/de/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/de/errors.json')).default,
  }),
  fr: async () => ({
    common: (await import('@gustri/i18n/locales/fr/common.json')).default,
    customer: (await import('@gustri/i18n/locales/fr/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/fr/errors.json')).default,
  }),
  es: async () => ({
    common: (await import('@gustri/i18n/locales/es/common.json')).default,
    customer: (await import('@gustri/i18n/locales/es/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/es/errors.json')).default,
  }),
  pt: async () => ({
    common: (await import('@gustri/i18n/locales/pt/common.json')).default,
    customer: (await import('@gustri/i18n/locales/pt/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/pt/errors.json')).default,
  }),
  th: async () => ({
    common: (await import('@gustri/i18n/locales/th/common.json')).default,
    customer: (await import('@gustri/i18n/locales/th/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/th/errors.json')).default,
  }),
  id: async () => ({
    common: (await import('@gustri/i18n/locales/id/common.json')).default,
    customer: (await import('@gustri/i18n/locales/id/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/id/errors.json')).default,
  }),
  uk: async () => ({
    common: (await import('@gustri/i18n/locales/uk/common.json')).default,
    customer: (await import('@gustri/i18n/locales/uk/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/uk/errors.json')).default,
  }),
  ar: async () => ({
    common: (await import('@gustri/i18n/locales/ar/common.json')).default,
    customer: (await import('@gustri/i18n/locales/ar/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/ar/errors.json')).default,
  }),
  ko: async () => ({
    common: (await import('@gustri/i18n/locales/ko/common.json')).default,
    customer: (await import('@gustri/i18n/locales/ko/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/ko/errors.json')).default,
  }),
  it: async () => ({
    common: (await import('@gustri/i18n/locales/it/common.json')).default,
    customer: (await import('@gustri/i18n/locales/it/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/it/errors.json')).default,
  }),
  fa: async () => ({
    common: (await import('@gustri/i18n/locales/fa/common.json')).default,
    customer: (await import('@gustri/i18n/locales/fa/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/fa/errors.json')).default,
  }),
  el: async () => ({
    common: (await import('@gustri/i18n/locales/el/common.json')).default,
    customer: (await import('@gustri/i18n/locales/el/customer.json')).default,
    errors: (await import('@gustri/i18n/locales/el/errors.json')).default,
  }),
};

// Dynamically load and switch language (only loads the requested language on demand)
export async function loadAndSwitchLanguage(lang: string) {
  if (lang === 'ja') {
    i18n.changeLanguage('ja');
    return;
  }

  // Skip if already loaded
  if (i18n.hasResourceBundle(lang, 'common')) {
    i18n.changeLanguage(lang);
    return;
  }

  const loader = languageLoaders[lang];
  if (!loader) {
    return;
  }

  try {
    const bundles = await loader();
    i18n.addResourceBundle(lang, 'common', bundles.common);
    i18n.addResourceBundle(lang, 'customer', bundles.customer);
    i18n.addResourceBundle(lang, 'errors', bundles.errors);
    i18n.changeLanguage(lang);
  } catch {
    i18n.changeLanguage('ja');
  }
}
