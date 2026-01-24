import { create } from 'zustand';

import { api, type User } from '../generated/api.js';

export interface UsersState {
  items: User[];
  selfUserId?: string;
  initialized: boolean;
  initialize: () => Promise<void>;
  syncUsers: () => Promise<void>;
  announcePresence: (userId: string) => Promise<void>;
  sendHello: (userId: string) => Promise<void>;
  upsert: (user: User) => void;
  remove: (userId: string) => void;
  replaceAll: (users: User[]) => void;
  clear: () => void;
}

const sortUsers = (a: User, b: User) => a.name.localeCompare(b.name);

const upsertUser = (items: User[], user: User) => {
  const next = [...items];
  const index = next.findIndex((entry) => entry._id === user._id);
  if (index >= 0) {
    next[index] = user;
  } else {
    next.push(user);
  }
  next.sort(sortUsers);
  return next;
};

const normalizeUsers = (users: User[]) => {
  const deduped = new Map<string, User>();
  users.forEach((user) => {
    deduped.set(user._id, user);
  });
  return Array.from(deduped.values()).sort(sortUsers);
};

export const useUsersStore = create<UsersState>((set, get) => ({
  items: [],
  selfUserId: undefined,
  initialized: false,
  initialize: async () => {
    if (get().initialized) {
      return;
    }

    api({
      onUserJoined: (payload) => {
        useUsersStore.getState().upsert(payload);
      },
      onHello: (payload) => {
        const selfUserId = useUsersStore.getState().selfUserId;
        if (!selfUserId || payload.userId === selfUserId) {
          return;
        }
        void useUsersStore.getState().announcePresence(selfUserId);
      },
      onUserLeft: (payload) => {
        useUsersStore.getState().remove(payload._id);
      },
    });
    api.onUserJoined.on?.();
    api.onHello.on?.();
    api.onUserLeft.on?.();
    set({ initialized: true });
    await get().syncUsers();
  },
  syncUsers: async () => {
    const users = await api.listUsers({});
    get().replaceAll(users);
  },
  announcePresence: async (userId) => {
    set({ selfUserId: userId });
    const joined = await api.joinChat({ _id: userId });
    get().upsert(joined);
    await get().syncUsers();
  },
  sendHello: async (userId) => {
    await api.hello({ userId });
  },
  upsert: (user) => set((state) => ({ items: upsertUser(state.items, user) })),
  remove: (userId) => set((state) => ({ items: state.items.filter((entry) => entry._id !== userId) })),
  replaceAll: (users) => set({ items: normalizeUsers(users) }),
  clear: () => set({ items: [], selfUserId: undefined }),
}));
