import { create } from 'zustand';

import { useUsersStore } from './users.js';

export interface SessionState {
  name: string;
  nameInput: string;
  setNameInput: (value: string) => void;
  commitName: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  name: '',
  nameInput: '',
  setNameInput: (value) => set({ nameInput: value }),
  commitName: () => {
    const trimmed = get().nameInput.trim();
    if (!trimmed) {
      return;
    }
    set({ name: trimmed });
    const usersStore = useUsersStore.getState();
    usersStore.upsert({ _id: trimmed, name: trimmed });
    void (async () => {
      await usersStore.announcePresence(trimmed);
      await usersStore.sendHello(trimmed);
    })();
  },
}));
