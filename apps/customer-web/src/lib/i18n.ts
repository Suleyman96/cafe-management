'use client';

import { i18n, initI18n } from '@gustri/i18n';
import commonJa from '@gustri/i18n/locales/ja/common.json';
import customerJa from '@gustri/i18n/locales/ja/customer.json';

initI18n({
  lng: 'ja',
  namespaces: ['common', 'customer'],
  resources: {
    ja: {
      common: commonJa,
      customer: customerJa,
    },
  },
});

type NamespaceBundles = {
  common: Record<string, unknown>;
  customer: Record<string, unknown>;
};

// Static import map — webpack can resolve each path at build time
const languageLoaders: Record<string, () => Promise<NamespaceBundles>> = {
  en: async () => ({
    common: (await import('@gustri/i18n/locales/en/common.json')).default,
    customer: (await import('@gustri/i18n/locales/en/customer.json')).default,
  }),
  az: async () => ({
    common: (await import('@gustri/i18n/locales/az/common.json')).default,
    customer: (await import('@gustri/i18n/locales/az/customer.json')).default,
  }),
  ru: async () => ({
    common: (await import('@gustri/i18n/locales/ru/common.json')).default,
    customer: (await import('@gustri/i18n/locales/ru/customer.json')).default,
  }),
  tr: async () => ({
    common: (await import('@gustri/i18n/locales/tr/common.json')).default,
    customer: (await import('@gustri/i18n/locales/tr/customer.json')).default,
  }),
  ka: async () => ({
    common: (await import('@gustri/i18n/locales/ka/common.json')).default,
    customer: (await import('@gustri/i18n/locales/ka/customer.json')).default,
  }),
  kk: async () => ({
    common: (await import('@gustri/i18n/locales/kk/common.json')).default,
    customer: (await import('@gustri/i18n/locales/kk/customer.json')).default,
  }),
  uz: async () => ({
    common: (await import('@gustri/i18n/locales/uz/common.json')).default,
    customer: (await import('@gustri/i18n/locales/uz/customer.json')).default,
  }),
  de: async () => ({
    common: (await import('@gustri/i18n/locales/de/common.json')).default,
    customer: (await import('@gustri/i18n/locales/de/customer.json')).default,
  }),
  fr: async () => ({
    common: (await import('@gustri/i18n/locales/fr/common.json')).default,
    customer: (await import('@gustri/i18n/locales/fr/customer.json')).default,
  }),
  es: async () => ({
    common: (await import('@gustri/i18n/locales/es/common.json')).default,
    customer: (await import('@gustri/i18n/locales/es/customer.json')).default,
  }),
  pt: async () => ({
    common: (await import('@gustri/i18n/locales/pt/common.json')).default,
    customer: (await import('@gustri/i18n/locales/pt/customer.json')).default,
  }),
  th: async () => ({
    common: (await import('@gustri/i18n/locales/th/common.json')).default,
    customer: (await import('@gustri/i18n/locales/th/customer.json')).default,
  }),
  id: async () => ({
    common: (await import('@gustri/i18n/locales/id/common.json')).default,
    customer: (await import('@gustri/i18n/locales/id/customer.json')).default,
  }),
  uk: async () => ({
    common: (await import('@gustri/i18n/locales/uk/common.json')).default,
    customer: (await import('@gustri/i18n/locales/uk/customer.json')).default,
  }),
  ar: async () => ({
    common: (await import('@gustri/i18n/locales/ar/common.json')).default,
    customer: (await import('@gustri/i18n/locales/ar/customer.json')).default,
  }),
  ko: async () => ({
    common: (await import('@gustri/i18n/locales/ko/common.json')).default,
    customer: (await import('@gustri/i18n/locales/ko/customer.json')).default,
  }),
  it: async () => ({
    common: (await import('@gustri/i18n/locales/it/common.json')).default,
    customer: (await import('@gustri/i18n/locales/it/customer.json')).default,
  }),
  fa: async () => ({
    common: (await import('@gustri/i18n/locales/fa/common.json')).default,
    customer: (await import('@gustri/i18n/locales/fa/customer.json')).default,
  }),
  el: async () => ({
    common: (await import('@gustri/i18n/locales/el/common.json')).default,
    customer: (await import('@gustri/i18n/locales/el/customer.json')).default,
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
    i18n.changeLanguage(lang);
  } catch {
    i18n.changeLanguage('ja');
  }
}
