import { useLanguageStore } from '@/store/language-store';

beforeEach(() => {
  localStorage.clear();
  useLanguageStore.setState({
    language: 'en',
    hasUserChosenLanguage: false,
  });
});

describe('useLanguageStore', () => {
  it('has correct default state', () => {
    const state = useLanguageStore.getState();
    expect(state.language).toBe('en');
    expect(state.hasUserChosenLanguage).toBe(false);
  });

  describe('setLanguage', () => {
    it('sets language and marks user has chosen', () => {
      useLanguageStore.getState().setLanguage('az');

      const state = useLanguageStore.getState();
      expect(state.language).toBe('az');
      expect(state.hasUserChosenLanguage).toBe(true);
    });

    it('allows changing language multiple times', () => {
      useLanguageStore.getState().setLanguage('az');
      useLanguageStore.getState().setLanguage('ru');
      useLanguageStore.getState().setLanguage('tr');

      const state = useLanguageStore.getState();
      expect(state.language).toBe('tr');
      expect(state.hasUserChosenLanguage).toBe(true);
    });
  });
});
