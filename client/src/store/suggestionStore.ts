import { create } from 'zustand';

interface SuggestionState {
  showModal: boolean;
  suggestionText: string;
  streaming: boolean;
  shownThisSession: boolean;
  lastSuggestions: string | null;
  lastSuggestionsDate: string | null;
  showLastPanel: boolean;
  openModal: () => void;
  closeModal: () => void;
  setSuggestionText: (text: string | ((prev: string) => string)) => void;
  setStreaming: (v: boolean) => void;
  markShown: () => void;
  saveLastSuggestions: (text: string) => void;
  openLastPanel: () => void;
  closeLastPanel: () => void;
}

export const useSuggestionStore = create<SuggestionState>((set) => ({
  showModal: false,
  suggestionText: '',
  streaming: false,
  shownThisSession: sessionStorage.getItem('suggestionsShown') === '1',
  lastSuggestions: localStorage.getItem('lastSuggestions'),
  lastSuggestionsDate: localStorage.getItem('lastSuggestionsDate'),
  showLastPanel: false,
  openModal: () => set({ showModal: true }),
  closeModal: () => set({ showModal: false }),
  setSuggestionText: (text) =>
    set((s) => ({ suggestionText: typeof text === 'function' ? text(s.suggestionText) : text })),
  setStreaming: (v) => set({ streaming: v }),
  markShown: () => {
    sessionStorage.setItem('suggestionsShown', '1');
    set({ shownThisSession: true });
  },
  saveLastSuggestions: (text) => {
    const date = new Date().toISOString();
    localStorage.setItem('lastSuggestions', text);
    localStorage.setItem('lastSuggestionsDate', date);
    set({ lastSuggestions: text, lastSuggestionsDate: date });
  },
  openLastPanel: () => set({ showLastPanel: true }),
  closeLastPanel: () => set({ showLastPanel: false }),
}));
