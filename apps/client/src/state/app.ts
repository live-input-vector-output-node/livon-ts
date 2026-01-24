import { create } from 'zustand';

import { useConnectionStore } from './connection.js';
import { useMessagesStore } from './messages.js';
import { useSessionStore } from './session.js';
import { useUsersStore } from './users.js';

export interface AppState {
  initialized: boolean;
  initialize: () => Promise<void>;
}

let lifecycleRegistered = false;

const ensureConnectionAndAnnouncePresence = async () => {
  await useConnectionStore.getState().ensureConnected();
  const name = useSessionStore.getState().name.trim();
  if (!name) {
    return;
  }
  const users = useUsersStore.getState();
  await users.announcePresence(name);
  await users.sendHello(name);
};

const registerPresenceLifecycleHandlers = () => {
  if (lifecycleRegistered) {
    return;
  }

  const triggerPresenceRefresh = () => {
    void ensureConnectionAndAnnouncePresence();
  };

  window.addEventListener('focus', triggerPresenceRefresh);
  window.addEventListener('online', triggerPresenceRefresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      triggerPresenceRefresh();
    }
  });

  lifecycleRegistered = true;
};

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,
  initialize: async () => {
    if (get().initialized) {
      useMessagesStore.getState().initialize();
      await useUsersStore.getState().initialize();
      registerPresenceLifecycleHandlers();
      return;
    }

    set({ initialized: true });
    await useConnectionStore.getState().connect();
    useMessagesStore.getState().initialize();
    await useUsersStore.getState().initialize();
    registerPresenceLifecycleHandlers();
  },
}));

void useAppStore.getState().initialize();
