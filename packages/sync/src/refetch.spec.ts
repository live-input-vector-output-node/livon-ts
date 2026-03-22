import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entity, type Entity } from './entity.js';
import { source, type Source } from './source.js';
import { randomNumber, randomString } from './testing/randomData.js';

interface User {
  id: string;
  name: string;
}

interface UserSlug {
  slugId: number;
}

interface SearchPayload {
  search: string;
}

type UsersResult = readonly User[];
type UserEntity = Entity<User>;
type ReadUsersSource = Source<UserSlug, SearchPayload, UsersResult, UsersResult>;

describe('source.refetch()', () => {
  let runMock = vi.fn();
  let usersEntity: UserEntity;
  let readUsers: ReadUsersSource;
  let slugId: number;
  let searchValue: string;

  beforeEach(() => {
    slugId = randomNumber();
    searchValue = randomString({ prefix: 'search' });

    runMock = vi.fn(async ({ payload, upsertMany }) => {
      upsertMany([{ id: payload.search, name: payload.search }]);
    });

    usersEntity = entity<User>({
      idOf: (value) => value.id,
      ttl: 30_000,
    });

    readUsers = source<UserSlug, SearchPayload, User, UsersResult, UsersResult>({
      entity: usersEntity,
      run: runMock,
    });
  });

  describe('happy', () => {
    it('should reuse current scope and payload when refetch()() is called', async () => {
      const usersStore = readUsers({ slugId });

      await usersStore.run({ search: searchValue });
      runMock.mockClear();

      await usersStore.refetch()();

      expect(runMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          scope: { slugId },
          payload: { search: searchValue },
        }),
      );
    });

    it('should replace scope when refetch(nextSlug)() is called', async () => {
      const usersStore = readUsers({ slugId });
      const nextSlugId = randomNumber();

      await usersStore.run({ search: searchValue });
      runMock.mockClear();
      await usersStore.refetch({ slugId: nextSlugId })();

      expect(runMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ scope: { slugId: nextSlugId } }),
      );
    });

    it('should replace payload when refetch()(nextPayload) is called', async () => {
      const usersStore = readUsers({ slugId });
      const nextSearchValue = randomString({ prefix: 'next-search' });

      await usersStore.refetch()({ search: nextSearchValue });

      expect(runMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ payload: { search: nextSearchValue } }),
      );
    });

    it('should update scope when refetch receives scope updater callback', async () => {
      const usersStore = readUsers({ slugId });
      const updatedSlugId = randomNumber();

      await usersStore.run({ search: searchValue });
      runMock.mockClear();
      await usersStore.refetch((scope) => ({ ...scope, slugId: updatedSlugId }))();

      expect(runMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ scope: { slugId: updatedSlugId } }),
      );
    });

    it('should update payload when refetch receives payload updater callback', async () => {
      const usersStore = readUsers({ slugId });
      const nextSearchValue = randomString({ prefix: 'next-search' });

      await usersStore.run({ search: searchValue });
      runMock.mockClear();
      await usersStore.refetch()((payload) => ({ ...payload, search: nextSearchValue }));

      expect(runMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ payload: { search: nextSearchValue } }),
      );
    });
  });
});
