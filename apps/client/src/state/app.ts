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
  try {
    await useConnectionStore.getState().ensureConnected();
    const name = useSessionStore.getState().name.trim();
    if (!name) {
      return;
    }
    const users = useUsersStore.getState();
    await users.announcePresence(name);
    await users.sendHello(name);
  } catch (error) {
    console.warn('livon: presence refresh skipped', error);
  }
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
      try {
        await useUsersStore.getState().initialize();
      } catch (error) {
        console.warn('livon: users initialization skipped', error);
      }
      registerPresenceLifecycleHandlers();
      return;
    }

    set({ initialized: true });
    await useConnectionStore.getState().connect();
    useMessagesStore.getState().initialize();
    try {
      await useUsersStore.getState().initialize();
    } catch (error) {
      console.warn('livon: users initialization skipped', error);
    }
    registerPresenceLifecycleHandlers();
  },
}));

void useAppStore.getState().initialize();
