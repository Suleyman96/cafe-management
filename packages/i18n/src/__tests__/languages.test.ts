import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGE, LANGUAGE_CODES, LANGUAGES } from '../languages';

describe('LANGUAGES', () => {
  it('contains 20 languages', () => {
    expect(LANGUAGES).toHaveLength(20);
  });

  it('every language has code, name, nativeName, and flag', () => {
    for (const lang of LANGUAGES) {
      expect(lang.code).toBeTypeOf('string');
      expect(lang.name).toBeTypeOf('string');
      expect(lang.nativeName).toBeTypeOf('string');
      expect(lang.flag).toBeTypeOf('string');
      expect(lang.code.length).toBeGreaterThan(0);
    }
  });

  it('language codes are unique', () => {
    const codes = LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('includes the documented core languages (en, ja, ko, ru, tr, az)', () => {
    const codes = LANGUAGES.map((l) => l.code);
    for (const c of ['en', 'ja', 'ko', 'ru', 'tr', 'az']) {
      expect(codes).toContain(c);
    }
  });
});

describe('LANGUAGE_CODES', () => {
  it('matches the codes from LANGUAGES', () => {
    expect(LANGUAGE_CODES).toEqual(LANGUAGES.map((l) => l.code));
  });
});

describe('DEFAULT_LANGUAGE', () => {
  it('is one of the supported language codes', () => {
    expect(LANGUAGE_CODES).toContain(DEFAULT_LANGUAGE);
  });

  it('is "ja" (Japanese)', () => {
    expect(DEFAULT_LANGUAGE).toBe('ja');
  });
});
