import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api, type Message } from '@livon/generated';
import { GLOBAL_ROOM_ID, useMessagesStore } from './messages.js';
import { useSessionStore } from './session.js';
import { useUsersStore } from './users.js';

vi.mock('@livon/generated', () => {
  const apiMock = Object.assign(vi.fn(), {
    hello: vi.fn(),
    joinChat: vi.fn(),
    listUsers: vi.fn(),
    sendMessage: vi.fn(),
  });
  return {
    api: apiMock,
  };
});

interface CreateMessageInput {
  id: string;
  author: string;
  roomId?: string;
}

const createMessage = ({ id, author, roomId = GLOBAL_ROOM_ID }: CreateMessageInput): Message => ({
  id,
  author,
  roomId,
  text: `message-${id}`,
  createdAt: new Date('2026-05-19T00:00:00.000Z'),
});

const resetStores = (): void => {
  useMessagesStore.getState().clear();
  useUsersStore.getState().clear();
  useSessionStore.setState({ name: '', nameInput: '' });
};

describe('messages state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it('initializes subscription handlers once', () => {
    useMessagesStore.getState().initialize();
    useMessagesStore.getState().initialize();

    expect(api).toHaveBeenCalledTimes(1);
    expect(useMessagesStore.getState().initialized).toBe(true);
  });

  it('tracks unread direct messages by room and peer', () => {
    useSessionStore.setState({ name: 'Alice', nameInput: 'Alice' });
    const roomId = 'dm:Alice:Bob';

    useMessagesStore.getState().ingest(roomId, createMessage({ id: 'message-1', author: 'Bob', roomId }));

    expect(useMessagesStore.getState().unreadByRoom[roomId]).toBe(1);
    expect(useMessagesStore.getState().unreadByUser.Bob).toBe(1);
  });

  it('marks the active direct room as read', () => {
    useSessionStore.setState({ name: 'Alice', nameInput: 'Alice' });
    const roomId = 'dm:Alice:Bob';
    useMessagesStore.getState().ingest(roomId, createMessage({ id: 'message-1', author: 'Bob', roomId }));
    useMessagesStore.getState().enterDirectRoom('Bob');

    useMessagesStore.getState().onMessagesRendered({} as HTMLDivElement);

    expect(useMessagesStore.getState().unreadByRoom[roomId]).toBe(0);
    expect(useMessagesStore.getState().unreadByUser.Bob).toBe(0);
  });

  it('sends through the generated api and ingests the response', async () => {
    const sentMessage = createMessage({ id: 'message-2', author: 'Alice' });
    vi.mocked(api.sendMessage).mockResolvedValue(sentMessage);

    await useMessagesStore.getState().sendToActiveRoom('Hello', 'Alice');

    expect(api.sendMessage).toHaveBeenCalledWith({ author: 'Alice', text: 'Hello', roomId: GLOBAL_ROOM_ID });
    expect(useMessagesStore.getState().items).toEqual([sentMessage]);
  });
});
