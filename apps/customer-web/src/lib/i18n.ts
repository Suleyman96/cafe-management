'use client';

import { i18n, initI18n } from '@cafe-idare/i18n';
import commonEn from '@cafe-idare/i18n/locales/en/common.json';
import customerEn from '@cafe-idare/i18n/locales/en/customer.json';

initI18n({
  lng: 'en',
  namespaces: ['common', 'customer'],
  resources: {
    en: {
      common: commonEn,
      customer: customerEn,
    },
  },
});

type NamespaceBundles = {
  common: any;
  customer: any;
};

// Static import map — webpack can resolve each path at build time
const languageLoaders: Record<string, () => Promise<NamespaceBundles>> = {
  az: async () => ({
    common: (await import('@cafe-idare/i18n/locales/az/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/az/customer.json')).default,
  }),
  ru: async () => ({
    common: (await import('@cafe-idare/i18n/locales/ru/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/ru/customer.json')).default,
  }),
  tr: async () => ({
    common: (await import('@cafe-idare/i18n/locales/tr/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/tr/customer.json')).default,
  }),
  ja: async () => ({
    common: (await import('@cafe-idare/i18n/locales/ja/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/ja/customer.json')).default,
  }),
  ka: async () => ({
    common: (await import('@cafe-idare/i18n/locales/ka/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/ka/customer.json')).default,
  }),
  kk: async () => ({
    common: (await import('@cafe-idare/i18n/locales/kk/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/kk/customer.json')).default,
  }),
  uz: async () => ({
    common: (await import('@cafe-idare/i18n/locales/uz/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/uz/customer.json')).default,
  }),
  de: async () => ({
    common: (await import('@cafe-idare/i18n/locales/de/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/de/customer.json')).default,
  }),
  fr: async () => ({
    common: (await import('@cafe-idare/i18n/locales/fr/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/fr/customer.json')).default,
  }),
  es: async () => ({
    common: (await import('@cafe-idare/i18n/locales/es/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/es/customer.json')).default,
  }),
  pt: async () => ({
    common: (await import('@cafe-idare/i18n/locales/pt/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/pt/customer.json')).default,
  }),
  th: async () => ({
    common: (await import('@cafe-idare/i18n/locales/th/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/th/customer.json')).default,
  }),
  id: async () => ({
    common: (await import('@cafe-idare/i18n/locales/id/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/id/customer.json')).default,
  }),
  uk: async () => ({
    common: (await import('@cafe-idare/i18n/locales/uk/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/uk/customer.json')).default,
  }),
  ar: async () => ({
    common: (await import('@cafe-idare/i18n/locales/ar/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/ar/customer.json')).default,
  }),
  ko: async () => ({
    common: (await import('@cafe-idare/i18n/locales/ko/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/ko/customer.json')).default,
  }),
  it: async () => ({
    common: (await import('@cafe-idare/i18n/locales/it/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/it/customer.json')).default,
  }),
  fa: async () => ({
    common: (await import('@cafe-idare/i18n/locales/fa/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/fa/customer.json')).default,
  }),
  el: async () => ({
    common: (await import('@cafe-idare/i18n/locales/el/common.json')).default,
    customer: (await import('@cafe-idare/i18n/locales/el/customer.json')).default,
  }),
};

// Dynamically load and switch language (only loads the requested language on demand)
export async function loadAndSwitchLanguage(lang: string) {
  if (lang === 'en') {
    i18n.changeLanguage('en');
    return;
  }

  // Skip if already loaded
  if (i18n.hasResourceBundle(lang, 'common')) {
    i18n.changeLanguage(lang);
    return;
  }

  const loader = languageLoaders[lang];
  if (!loader) {
    console.warn(`No translations available for language: ${lang}`);
    return;
  }

  try {
    const bundles = await loader();
    i18n.addResourceBundle(lang, 'common', bundles.common);
    i18n.addResourceBundle(lang, 'customer', bundles.customer);
    i18n.changeLanguage(lang);
  } catch (err) {
    console.warn(`Failed to load translations for ${lang}, falling back to English`, err);
    i18n.changeLanguage('en');
  }
}
