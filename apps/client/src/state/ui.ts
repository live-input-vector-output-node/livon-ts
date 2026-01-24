import { create } from 'zustand';

import { useMessagesStore } from './messages.js';
import { useSessionStore } from './session.js';

export interface UiState {
  textInput: string;
  setTextInput: (value: string) => void;
  clearTextInput: () => void;
  submitMessage: () => Promise<void>;
}

export const useUiStore = create<UiState>((set, get) => ({
  textInput: '',
  setTextInput: (value) => set({ textInput: value }),
  clearTextInput: () => set({ textInput: '' }),
  submitMessage: async () => {
    const text = get().textInput.trim();
    const author = useSessionStore.getState().name.trim();
    if (!text || !author) {
      return;
    }
    await useMessagesStore.getState().sendToActiveRoom(text, author);
    set({ textInput: '' });
  },
}));
