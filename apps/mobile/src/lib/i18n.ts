import { initI18n } from '@cafe-idare/i18n';
import authEn from '@cafe-idare/i18n/locales/en/auth.json';
import commonEn from '@cafe-idare/i18n/locales/en/common.json';
import navEn from '@cafe-idare/i18n/locales/en/nav.json';
import rolesEn from '@cafe-idare/i18n/locales/en/roles.json';
import staffEn from '@cafe-idare/i18n/locales/en/staff.json';

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
