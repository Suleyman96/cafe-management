import { i18n, initI18n } from '@gustri/i18n';
import authEn from '@gustri/i18n/locales/en/auth.json';
import commonEn from '@gustri/i18n/locales/en/common.json';
import errorsEn from '@gustri/i18n/locales/en/errors.json';
import navEn from '@gustri/i18n/locales/en/nav.json';
import rolesEn from '@gustri/i18n/locales/en/roles.json';
import staffEn from '@gustri/i18n/locales/en/staff.json';

// Detect device language (can be enhanced with expo-localization later)
const getDeviceLanguage = (): string => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require('expo-localization');
    const locales = getLocales();
    return locales?.[0]?.languageCode || 'en';
  } catch {
    return 'en';
  }
};

initI18n({
  lng: getDeviceLanguage(),
  namespaces: ['common', 'nav', 'auth', 'staff', 'roles', 'errors'],
  resources: {
    en: {
      common: commonEn,
      nav: navEn,
      auth: authEn,
      staff: staffEn,
      roles: rolesEn,
      errors: errorsEn,
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
  errors: TranslationBundle;
};

const languageLoaders: Record<string, () => Promise<NamespaceBundles>> = {
  en: async () => ({
    common: (await import('@gustri/i18n/locales/en/common.json')).default,
    nav: (await import('@gustri/i18n/locales/en/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/en/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/en/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/en/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/en/errors.json')).default,
  }),
  ja: async () => ({
    common: (await import('@gustri/i18n/locales/ja/common.json')).default,
    nav: (await import('@gustri/i18n/locales/ja/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/ja/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/ja/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/ja/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/ja/errors.json')).default,
  }),
  az: async () => ({
    common: (await import('@gustri/i18n/locales/az/common.json')).default,
    nav: (await import('@gustri/i18n/locales/az/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/az/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/az/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/az/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/az/errors.json')).default,
  }),
  ru: async () => ({
    common: (await import('@gustri/i18n/locales/ru/common.json')).default,
    nav: (await import('@gustri/i18n/locales/ru/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/ru/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/ru/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/ru/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/ru/errors.json')).default,
  }),
  tr: async () => ({
    common: (await import('@gustri/i18n/locales/tr/common.json')).default,
    nav: (await import('@gustri/i18n/locales/tr/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/tr/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/tr/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/tr/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/tr/errors.json')).default,
  }),
  ka: async () => ({
    common: (await import('@gustri/i18n/locales/ka/common.json')).default,
    nav: (await import('@gustri/i18n/locales/ka/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/ka/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/ka/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/ka/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/ka/errors.json')).default,
  }),
  kk: async () => ({
    common: (await import('@gustri/i18n/locales/kk/common.json')).default,
    nav: (await import('@gustri/i18n/locales/kk/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/kk/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/kk/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/kk/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/kk/errors.json')).default,
  }),
  uz: async () => ({
    common: (await import('@gustri/i18n/locales/uz/common.json')).default,
    nav: (await import('@gustri/i18n/locales/uz/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/uz/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/uz/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/uz/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/uz/errors.json')).default,
  }),
  de: async () => ({
    common: (await import('@gustri/i18n/locales/de/common.json')).default,
    nav: (await import('@gustri/i18n/locales/de/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/de/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/de/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/de/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/de/errors.json')).default,
  }),
  fr: async () => ({
    common: (await import('@gustri/i18n/locales/fr/common.json')).default,
    nav: (await import('@gustri/i18n/locales/fr/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/fr/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/fr/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/fr/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/fr/errors.json')).default,
  }),
  es: async () => ({
    common: (await import('@gustri/i18n/locales/es/common.json')).default,
    nav: (await import('@gustri/i18n/locales/es/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/es/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/es/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/es/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/es/errors.json')).default,
  }),
  pt: async () => ({
    common: (await import('@gustri/i18n/locales/pt/common.json')).default,
    nav: (await import('@gustri/i18n/locales/pt/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/pt/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/pt/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/pt/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/pt/errors.json')).default,
  }),
  th: async () => ({
    common: (await import('@gustri/i18n/locales/th/common.json')).default,
    nav: (await import('@gustri/i18n/locales/th/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/th/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/th/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/th/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/th/errors.json')).default,
  }),
  id: async () => ({
    common: (await import('@gustri/i18n/locales/id/common.json')).default,
    nav: (await import('@gustri/i18n/locales/id/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/id/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/id/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/id/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/id/errors.json')).default,
  }),
  uk: async () => ({
    common: (await import('@gustri/i18n/locales/uk/common.json')).default,
    nav: (await import('@gustri/i18n/locales/uk/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/uk/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/uk/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/uk/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/uk/errors.json')).default,
  }),
  ar: async () => ({
    common: (await import('@gustri/i18n/locales/ar/common.json')).default,
    nav: (await import('@gustri/i18n/locales/ar/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/ar/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/ar/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/ar/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/ar/errors.json')).default,
  }),
  ko: async () => ({
    common: (await import('@gustri/i18n/locales/ko/common.json')).default,
    nav: (await import('@gustri/i18n/locales/ko/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/ko/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/ko/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/ko/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/ko/errors.json')).default,
  }),
  it: async () => ({
    common: (await import('@gustri/i18n/locales/it/common.json')).default,
    nav: (await import('@gustri/i18n/locales/it/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/it/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/it/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/it/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/it/errors.json')).default,
  }),
  fa: async () => ({
    common: (await import('@gustri/i18n/locales/fa/common.json')).default,
    nav: (await import('@gustri/i18n/locales/fa/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/fa/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/fa/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/fa/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/fa/errors.json')).default,
  }),
  el: async () => ({
    common: (await import('@gustri/i18n/locales/el/common.json')).default,
    nav: (await import('@gustri/i18n/locales/el/nav.json')).default,
    auth: (await import('@gustri/i18n/locales/el/auth.json')).default,
    staff: (await import('@gustri/i18n/locales/el/staff.json')).default,
    roles: (await import('@gustri/i18n/locales/el/roles.json')).default,
    errors: (await import('@gustri/i18n/locales/el/errors.json')).default,
  }),
};

export async function loadAndSwitchLanguage(lang: string) {
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
  i18n.addResourceBundle(lang, 'errors', bundles.errors);

  i18n.changeLanguage(lang);
}
