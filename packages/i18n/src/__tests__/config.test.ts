import { describe, expect, it } from 'vitest';
import { i18n, initI18n } from '../config';
import { DEFAULT_LANGUAGE } from '../languages';

describe('initI18n', () => {
  it('initializes with the default language when none provided', async () => {
    await initI18n({
      resources: {
        [DEFAULT_LANGUAGE]: {
          common: { hello: 'こんにちは' },
        },
        en: {
          common: { hello: 'hello' },
        },
      },
    });
    expect(i18n.language).toBe(DEFAULT_LANGUAGE);
  });

  it('uses the provided lng option', async () => {
    await initI18n({
      lng: 'en',
      resources: {
        en: { common: { hello: 'hello' } },
        [DEFAULT_LANGUAGE]: { common: { hello: 'fallback' } },
      },
    });
    expect(i18n.language).toBe('en');
  });

  it('resolves translation keys', async () => {
    await initI18n({
      lng: 'en',
      resources: {
        en: { common: { greeting: 'Hello' } },
        [DEFAULT_LANGUAGE]: { common: { greeting: 'Fallback' } },
      },
    });
    expect(i18n.t('greeting')).toBe('Hello');
  });

  it('falls back to DEFAULT_LANGUAGE when key is missing in current locale', async () => {
    await initI18n({
      lng: 'en',
      resources: {
        en: { common: {} },
        [DEFAULT_LANGUAGE]: { common: { onlyJa: 'デフォルト' } },
      },
    });
    expect(i18n.t('onlyJa')).toBe('デフォルト');
  });

  it('returns the key itself when missing in all locales', async () => {
    await initI18n({
      lng: 'en',
      resources: {
        en: { common: {} },
        [DEFAULT_LANGUAGE]: { common: {} },
      },
    });
    // i18next's default behavior is to return the key string when it can't resolve
    expect(i18n.t('some.missing.key')).toBe('some.missing.key');
  });

  it('changeLanguage swaps the active locale', async () => {
    await initI18n({
      resources: {
        en: { common: { hello: 'Hello' } },
        [DEFAULT_LANGUAGE]: { common: { hello: 'こんにちは' } },
      },
    });
    await i18n.changeLanguage('en');
    expect(i18n.language).toBe('en');
    expect(i18n.t('hello')).toBe('Hello');
    await i18n.changeLanguage(DEFAULT_LANGUAGE);
    expect(i18n.t('hello')).toBe('こんにちは');
  });

  it('honors custom namespaces', async () => {
    await initI18n({
      lng: 'en',
      namespaces: ['common', 'nav'],
      resources: {
        en: {
          common: { home: 'Home' },
          nav: { settings: 'Settings' },
        },
        [DEFAULT_LANGUAGE]: { common: { home: 'ホーム' }, nav: { settings: '設定' } },
      },
    });
    expect(i18n.t('home', { ns: 'common' })).toBe('Home');
    expect(i18n.t('settings', { ns: 'nav' })).toBe('Settings');
  });
});
