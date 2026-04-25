'use client';

import { i18n, initI18n } from '@gustri/i18n';
import authEn from '@gustri/i18n/locales/en/auth.json';
import commonEn from '@gustri/i18n/locales/en/common.json';
import navEn from '@gustri/i18n/locales/en/nav.json';
import rolesEn from '@gustri/i18n/locales/en/roles.json';
import staffEn from '@gustri/i18n/locales/en/staff.json';

initI18n({
  lng: 'en',
  namespaces: ['common', 'nav', 'auth', 'staff', 'roles'],
  resources: {
    en: {
      common: commonEn,
      nav: navEn,
      auth: authEn,
      staff: staffEn,
      roles: rolesEn,
    },
  },
});

type TranslationBundle = Record<string, unknown>;

type NamespaceBundles = {
  common: TranslationBundle;
  nav: TranslationBundle;
  auth: TranslationBundle;
  staff: TranslationBundle;
  roles: TranslationBundle;
};

// Static import map — webpack can resolve each path at build time
const languageLoaders: Record<string, () => Promise<NamespaceBundles>> = {
  en: async () => ({
    common: (await import('@gustri/i18n/locales/en/common.json')).default,
    nav: (await import('@gustri/i18n/locales/en/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/en/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/en/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/en/roles.json')).default,
  }),
  az: async () => ({
    common: (await import('@gustri/i18n/locales/az/common.json')).default,
    nav: (await import('@gustri/i18n/locales/az/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/az/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/az/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/az/roles.json')).default,
  }),
  ru: async () => ({
    common: (await import('@gustri/i18n/locales/ru/common.json')).default,
    nav: (await import('@gustri/i18n/locales/ru/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/ru/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/ru/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/ru/roles.json')).default,
  }),
  tr: async () => ({
    common: (await import('@gustri/i18n/locales/tr/common.json')).default,
    nav: (await import('@gustri/i18n/locales/tr/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/tr/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/tr/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/tr/roles.json')).default,
  }),
  ka: async () => ({
    common: (await import('@gustri/i18n/locales/ka/common.json')).default,
    nav: (await import('@gustri/i18n/locales/ka/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/ka/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/ka/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/ka/roles.json')).default,
  }),
  kk: async () => ({
    common: (await import('@gustri/i18n/locales/kk/common.json')).default,
    nav: (await import('@gustri/i18n/locales/kk/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/kk/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/kk/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/kk/roles.json')).default,
  }),
  uz: async () => ({
    common: (await import('@gustri/i18n/locales/uz/common.json')).default,
    nav: (await import('@gustri/i18n/locales/uz/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/uz/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/uz/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/uz/roles.json')).default,
  }),
  de: async () => ({
    common: (await import('@gustri/i18n/locales/de/common.json')).default,
    nav: (await import('@gustri/i18n/locales/de/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/de/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/de/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/de/roles.json')).default,
  }),
  fr: async () => ({
    common: (await import('@gustri/i18n/locales/fr/common.json')).default,
    nav: (await import('@gustri/i18n/locales/fr/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/fr/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/fr/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/fr/roles.json')).default,
  }),
  es: async () => ({
    common: (await import('@gustri/i18n/locales/es/common.json')).default,
    nav: (await import('@gustri/i18n/locales/es/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/es/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/es/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/es/roles.json')).default,
  }),
  pt: async () => ({
    common: (await import('@gustri/i18n/locales/pt/common.json')).default,
    nav: (await import('@gustri/i18n/locales/pt/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/pt/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/pt/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/pt/roles.json')).default,
  }),
  th: async () => ({
    common: (await import('@gustri/i18n/locales/th/common.json')).default,
    nav: (await import('@gustri/i18n/locales/th/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/th/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/th/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/th/roles.json')).default,
  }),
  id: async () => ({
    common: (await import('@gustri/i18n/locales/id/common.json')).default,
    nav: (await import('@gustri/i18n/locales/id/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/id/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/id/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/id/roles.json')).default,
  }),
  uk: async () => ({
    common: (await import('@gustri/i18n/locales/uk/common.json')).default,
    nav: (await import('@gustri/i18n/locales/uk/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/uk/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/uk/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/uk/roles.json')).default,
  }),
  ar: async () => ({
    common: (await import('@gustri/i18n/locales/ar/common.json')).default,
    nav: (await import('@gustri/i18n/locales/ar/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/ar/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/ar/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/ar/roles.json')).default,
  }),
  ko: async () => ({
    common: (await import('@gustri/i18n/locales/ko/common.json')).default,
    nav: (await import('@gustri/i18n/locales/ko/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/ko/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/ko/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/ko/roles.json')).default,
  }),
  it: async () => ({
    common: (await import('@gustri/i18n/locales/it/common.json')).default,
    nav: (await import('@gustri/i18n/locales/it/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/it/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/it/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/it/roles.json')).default,
  }),
  fa: async () => ({
    common: (await import('@gustri/i18n/locales/fa/common.json')).default,
    nav: (await import('@gustri/i18n/locales/fa/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/fa/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/fa/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/fa/roles.json')).default,
  }),
  el: async () => ({
    common: (await import('@gustri/i18n/locales/el/common.json')).default,
    nav: (await import('@gustri/i18n/locales/el/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/el/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/el/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/el/roles.json')).default,
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

  const bundles = await loader();

  i18n.addResourceBundle(lang, 'common', bundles.common);
  i18n.addResourceBundle(lang, 'nav', bundles.nav);
  i18n.addResourceBundle(lang, 'auth', bundles.auth);
  i18n.addResourceBundle(lang, 'staff', bundles.staff);
  i18n.addResourceBundle(lang, 'roles', bundles.roles);

  i18n.changeLanguage(lang);
}
