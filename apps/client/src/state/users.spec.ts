import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api, type User } from '@livon/generated';
import type { LivonSubscriptionContext } from '@livon/client';
import { useUsersStore } from './users.js';

vi.mock('@livon/generated', () => {
  const apiMock = Object.assign(vi.fn(), {
    hello: vi.fn(),
    joinChat: vi.fn(),
    listUsers: vi.fn(),
  });
  return {
    api: apiMock,
  };
});

const alice: User = { _id: 'Alice', name: 'Alice' };
const bob: User = { _id: 'Bob', name: 'Bob' };
const charlie: User = { _id: 'Charlie', name: 'Charlie' };
const subscriptionContext: LivonSubscriptionContext = {
  eventId: 'event-1',
  remoteIdentifier: 'onHello',
  room: undefined,
};

describe('users state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUsersStore.getState().clear();
  });

  it('upserts and sorts users by display name', () => {
    useUsersStore.getState().upsert(charlie);
    useUsersStore.getState().upsert(alice);
    useUsersStore.getState().upsert({ _id: 'Charlie', name: 'Charles' });

    expect(useUsersStore.getState().items).toEqual([alice, { _id: 'Charlie', name: 'Charles' }]);
  });

  it('normalizes fetched users during sync', async () => {
    vi.mocked(api.listUsers).mockResolvedValue([bob, alice, bob]);

    await useUsersStore.getState().syncUsers();

    expect(useUsersStore.getState().items).toEqual([alice, bob]);
  });

  it('announces presence and refreshes users', async () => {
    vi.mocked(api.joinChat).mockResolvedValue(alice);
    vi.mocked(api.listUsers).mockResolvedValue([alice, bob]);

    await useUsersStore.getState().announcePresence('Alice');

    expect(api.joinChat).toHaveBeenCalledWith({ _id: 'Alice' });
    expect(api.listUsers).toHaveBeenCalledWith({});
    expect(useUsersStore.getState().selfUserId).toBe('Alice');
    expect(useUsersStore.getState().items).toEqual([alice, bob]);
  });

  it('registers subscription handlers and responds to hello pings', async () => {
    vi.mocked(api.listUsers).mockResolvedValue([alice]);
    vi.mocked(api.joinChat).mockResolvedValue(alice);

    await useUsersStore.getState().initialize();
    await vi.mocked(api).mock.calls[0]?.[0]?.onHello?.({ userId: 'Bob' }, subscriptionContext);

    expect(api).toHaveBeenCalledTimes(1);
    expect(useUsersStore.getState().initialized).toBe(true);
    expect(api.joinChat).not.toHaveBeenCalled();

    await useUsersStore.getState().announcePresence('Alice');
    await vi.mocked(api).mock.calls[0]?.[0]?.onHello?.({ userId: 'Bob' }, subscriptionContext);

    expect(api.joinChat).toHaveBeenCalledWith({ _id: 'Alice' });
  });

  it('removes users by identifier', () => {
    useUsersStore.getState().replaceAll([alice, bob]);

    useUsersStore.getState().remove('Bob');

    expect(useUsersStore.getState().items).toEqual([alice]);
  });
});
