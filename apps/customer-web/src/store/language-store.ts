import type { Language } from '@cafe-idare/i18n';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LanguageStore {
  language: Language;
  hasUserChosenLanguage: boolean;
  setLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: 'en',
      hasUserChosenLanguage: false,
      setLanguage: (language) => set({ language, hasUserChosenLanguage: true }),
    }),
    {
      name: 'language-storage',
      version: 1,
      migrate: (persisted: any, version: number) => {
        if (version === 0) {
          // Add the new flag — let the admin's default language take effect
          return { ...persisted, hasUserChosenLanguage: false };
        }
        return persisted as LanguageStore;
      },
    },
  ),
);
