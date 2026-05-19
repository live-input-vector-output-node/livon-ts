import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api, type User } from '@livon/generated';
import { useSessionStore } from './session.js';
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

describe('session state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUsersStore.getState().clear();
    useSessionStore.setState({ name: '', nameInput: '' });
    vi.mocked(api.joinChat).mockResolvedValue(alice);
    vi.mocked(api.listUsers).mockResolvedValue([alice]);
    vi.mocked(api.hello).mockResolvedValue({ userId: 'Alice' });
  });

  it('ignores blank session names', () => {
    useSessionStore.getState().setNameInput('   ');

    useSessionStore.getState().commitName();

    expect(useSessionStore.getState().name).toBe('');
    expect(api.joinChat).not.toHaveBeenCalled();
  });

  it('commits trimmed names and announces presence', async () => {
    useSessionStore.getState().setNameInput(' Alice ');

    useSessionStore.getState().commitName();
    await vi.waitFor(() => {
      expect(api.hello).toHaveBeenCalledWith({ userId: 'Alice' });
    });

    expect(useSessionStore.getState().name).toBe('Alice');
    expect(useUsersStore.getState().items).toEqual([alice]);
    expect(api.joinChat).toHaveBeenCalledWith({ _id: 'Alice' });
  });
});
