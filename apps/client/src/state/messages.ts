import { create } from 'zustand';

import { api, type Message } from '../generated/api.js';
import { useSessionStore } from './session.js';
import { useUsersStore } from './users.js';

export const GLOBAL_ROOM_ID = 'global';
const DIRECT_ROOM_PREFIX = 'dm:';

type ChatMode = 'global' | 'direct';

export interface MessagesState {
  items: Message[];
  itemsByRoom: Record<string, Message[]>;
  unreadByRoom: Record<string, number>;
  unreadByUser: Record<string, number>;
  activeRoomId: string;
  activeChatMode: ChatMode;
  activeDirectUserId?: string;
  activeChatLabel: string;
  initialized: boolean;
  initialize: () => void;
  ingest: (roomId: string, message: Message) => void;
  enterGlobalRoom: () => void;
  enterDirectRoom: (targetUserId: string) => void;
  leaveDirectRoom: () => void;
  markActiveRoomAsRead: () => void;
  onMessagesRendered: (element: HTMLDivElement | null) => void;
  sendToActiveRoom: (text: string, author: string) => Promise<void>;
  clear: () => void;
}

type MessageSetState = (
  partial:
    | Partial<MessagesState>
    | ((state: MessagesState) => Partial<MessagesState>),
) => void;

const directRoomId = (a: string, b: string) => {
  const [first, second] = [a, b].sort((left, right) => left.localeCompare(right));
  return `${DIRECT_ROOM_PREFIX}${first}:${second}`;
};

const directPeerFromRoom = (roomId: string, selfUserId: string): string | undefined => {
  if (!roomId.startsWith(DIRECT_ROOM_PREFIX)) {
    return undefined;
  }
  const pair = roomId.slice(DIRECT_ROOM_PREFIX.length).split(':');
  if (pair.length !== 2) {
    return undefined;
  }
  if (pair[0] === selfUserId) {
    return pair[1];
  }
  if (pair[1] === selfUserId) {
    return pair[0];
  }
  return undefined;
};

const roomLabel = (chatMode: ChatMode, targetUserId?: string) => {
  if (chatMode === 'global') {
    return '# Global Chat';
  }
  return `@ ${targetUserId}`;
};

const upsertAuthor = (message: Message) => {
  useUsersStore.getState().upsert({ _id: message.author, name: message.author });
};

const normalizeRoomId = (roomId?: string) => roomId || GLOBAL_ROOM_ID;

const roomIdFromMessageContext = (message: Message, roomFromContext?: string) =>
  normalizeRoomId(roomFromContext ?? message.roomId);

const markRoomAsRead = (state: MessagesState, roomId: string): Partial<MessagesState> => {
  const unreadCount = state.unreadByRoom[roomId] ?? 0;
  if (unreadCount <= 0) {
    return {};
  }

  const nextUnreadByRoom = { ...state.unreadByRoom, [roomId]: 0 };
  const selfUserId = useSessionStore.getState().name.trim();
  const peerUserId = selfUserId ? directPeerFromRoom(roomId, selfUserId) : undefined;

  if (!peerUserId) {
    return { unreadByRoom: nextUnreadByRoom };
  }

  const currentForPeer = state.unreadByUser[peerUserId] ?? 0;
  const nextForPeer = Math.max(0, currentForPeer - unreadCount);
  const nextUnreadByUser = { ...state.unreadByUser, [peerUserId]: nextForPeer };

  return {
    unreadByRoom: nextUnreadByRoom,
    unreadByUser: nextUnreadByUser,
  };
};

const setActiveRoom = (set: MessageSetState, roomId: string, chatMode: ChatMode, targetUserId?: string) => {
  set((state) => ({
    activeRoomId: roomId,
    activeChatMode: chatMode,
    activeDirectUserId: targetUserId,
    activeChatLabel: roomLabel(chatMode, targetUserId),
    items: state.itemsByRoom[roomId] ?? [],
  }));
};

export const useMessagesStore = create<MessagesState>((set, get) => ({
  items: [],
  itemsByRoom: {},
  unreadByRoom: {},
  unreadByUser: {},
  activeRoomId: GLOBAL_ROOM_ID,
  activeChatMode: 'global',
  activeDirectUserId: undefined,
  activeChatLabel: '# Global Chat',
  initialized: false,
  initialize: () => {
    if (get().initialized) {
      return;
    }

    api({
      onMessage: (payload, ctx) => {
        const roomId = roomIdFromMessageContext(payload, ctx.room);
        get().ingest(roomId, payload);
      },
    });

    set({ initialized: true });
  },
  ingest: (roomId, message) => {
    upsertAuthor(message);

    const selfUserId = useSessionStore.getState().name.trim();
    const isOwnMessage = Boolean(selfUserId) && message.author === selfUserId;

    set((state) => {
      const prev = state.itemsByRoom[roomId] ?? [];
      const exists = prev.some((entry) => entry.id === message.id);
      if (exists) {
        return {};
      }
      const nextRoomItems = [...prev, message];
      const nextItemsByRoom = { ...state.itemsByRoom, [roomId]: nextRoomItems };
      const next: Partial<MessagesState> = {
        itemsByRoom: nextItemsByRoom,
        items: roomId === state.activeRoomId ? nextRoomItems : state.items,
      };

      if (!isOwnMessage && roomId.startsWith(DIRECT_ROOM_PREFIX)) {
        const unreadRoomCount = (state.unreadByRoom[roomId] ?? 0) + 1;
        next.unreadByRoom = { ...state.unreadByRoom, [roomId]: unreadRoomCount };

        const peerUserId = message.author;
        const unreadForUser = (state.unreadByUser[peerUserId] ?? 0) + 1;
        next.unreadByUser = { ...state.unreadByUser, [peerUserId]: unreadForUser };
      }

      return next;
    });
  },
  enterGlobalRoom: () => {
    setActiveRoom(set, GLOBAL_ROOM_ID, 'global');
  },
  enterDirectRoom: (targetUserId) => {
    const self = useSessionStore.getState().name.trim();
    if (!self || targetUserId === self) {
      return;
    }
    useUsersStore.getState().upsert({ _id: targetUserId, name: targetUserId });
    setActiveRoom(set, directRoomId(self, targetUserId), 'direct', targetUserId);
  },
  leaveDirectRoom: () => {
    setActiveRoom(set, GLOBAL_ROOM_ID, 'global');
  },
  markActiveRoomAsRead: () => {
    set((state) => markRoomAsRead(state, state.activeRoomId));
  },
  onMessagesRendered: (element) => {
    if (!element) {
      return;
    }
    useMessagesStore.getState().markActiveRoomAsRead();
  },
  sendToActiveRoom: async (text, author) => {
    const roomId = get().activeRoomId;
    const message = await api.sendMessage({ author, text, roomId });
    get().ingest(roomIdFromMessageContext(message), message);
  },
  clear: () =>
    set({
      items: [],
      itemsByRoom: {},
      unreadByRoom: {},
      unreadByUser: {},
      activeRoomId: GLOBAL_ROOM_ID,
      activeChatMode: 'global',
      activeDirectUserId: undefined,
      activeChatLabel: '# Global Chat',
    }),
}));
