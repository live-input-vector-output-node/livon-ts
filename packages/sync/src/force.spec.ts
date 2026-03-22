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

describe('source.force()', () => {
  let runMock = vi.fn();
  let usersEntity: UserEntity;
  let readUsers: ReadUsersSource;
  let slugId: number;
  let searchValue: string;

  beforeEach(() => {
    slugId = randomNumber();
    searchValue = randomString({ prefix: 'search' });

    runMock = vi.fn(async ({ payload, entity }) => {
      entity.upsertMany([{ id: payload.search, name: payload.search }]);
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
    it('should call run twice when run then force are invoked', async () => {
      const usersStore = readUsers({ slugId });

      await usersStore.run({ search: searchValue });
      await usersStore.force();

      expect(runMock).toHaveBeenCalledTimes(2);
    });

    it('should keep scope and payload on forced call', async () => {
      const usersStore = readUsers({ slugId });

      await usersStore.run({ search: searchValue });
      await usersStore.force();

      expect(runMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          scope: { slugId },
          payload: { search: searchValue },
        }),
      );
    });
  });
});
