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

type UserEntity = Entity<User>;
type ReadUserSource = Source<UserSlug, SearchPayload, User | null, User>;

describe('source() branches', () => {
  let usersEntity: UserEntity;
  let readUser: ReadUserSource;
  let runMock = vi.fn();
  let slugId: number;
  let searchValue: string;

  beforeEach(() => {
    slugId = randomNumber();
    searchValue = randomString({ prefix: 'search' });

    usersEntity = entity<User>({
      idOf: (value) => value.id,
      ttl: 30_000,
    });

    runMock = vi.fn(async ({ payload, upsertOne }) => {
      upsertOne({ id: payload.search, name: payload.search });
    });

    readUser = source<UserSlug, SearchPayload, User, User | null, User>({
      entity: usersEntity,
      run: runMock,
    });
  });

  describe('happy', () => {
    it('should read current value when run calls getValue', async () => {
      let valueFromRun: User | null = {
        id: randomString({ prefix: 'seed-id' }),
        name: randomString({ prefix: 'seed-name' }),
      };

      readUser = source<UserSlug, SearchPayload, User, User | null, User>({
        entity: usersEntity,
        run: async ({ getValue, payload, upsertOne }) => {
          valueFromRun = getValue();
          upsertOne({ id: payload.search, name: payload.search });
        },
      });

      const userStore = readUser({ slugId });

      await userStore.run({ search: searchValue });

      expect(valueFromRun).toBeNull();
    });

    it('should keep explicit run return value when run returns raw result', async () => {
      const rawUser: User = {
        id: randomString({ prefix: 'raw-id' }),
        name: randomString({ prefix: 'raw-name' }),
      };

      readUser = source<UserSlug, SearchPayload, User, User | null, User>({
        entity: usersEntity,
        run: async () => {
          return rawUser;
        },
      });

      const userStore = readUser({ slugId });

      await userStore.run({ search: searchValue });

      expect(userStore.get()).toEqual(rawUser);
    });

    it('should remove effect listener when cleanup is called', () => {
      const userStore = readUser({ slugId });
      const listener = vi.fn();
      const remove = userStore.effect(listener);
      const setUser: User = {
        id: randomString({ prefix: 'set-id' }),
        name: randomString({ prefix: 'set-name' }),
      };

      remove?.();
      userStore.set(setUser);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should remove records when run calls removeOne and removeMany', async () => {
      const firstUserId = randomString({ prefix: 'first-user-id' });
      const secondUserId = randomString({ prefix: 'second-user-id' });
      const thirdUserId = randomString({ prefix: 'third-user-id' });
      const firstUserName = randomString({ prefix: 'first-user-name' });
      const secondUserName = randomString({ prefix: 'second-user-name' });
      const thirdUserName = randomString({ prefix: 'third-user-name' });

      const readUsers = source<UserSlug, SearchPayload, User, readonly User[], readonly User[]>({
        entity: usersEntity,
        run: async ({ removeMany, removeOne, upsertMany }) => {
          upsertMany([
            { id: firstUserId, name: firstUserName },
            { id: secondUserId, name: secondUserName },
            { id: thirdUserId, name: thirdUserName },
          ]);
          removeOne(firstUserId);
          removeMany([secondUserId]);
        },
      });

      const usersStore = readUsers({ slugId });

      await usersStore.run({ search: searchValue });

      expect(usersStore.get()).toEqual([{ id: thirdUserId, name: thirdUserName }]);
    });
  });

  describe('sad', () => {
    it('should not call run handler when run is invoked after destroy', async () => {
      const userStore = readUser({ slugId });

      userStore.destroy();
      await userStore.run();

      expect(runMock).not.toHaveBeenCalled();
    });

    it('should call cleanup immediately when cleanup resolves after destroy', async () => {
      const cleanup = vi.fn();

      readUser = source<UserSlug, SearchPayload, User, User | null, User>({
        entity: usersEntity,
        run: async () => {
          await Promise.resolve();

          return () => {
            cleanup();
          };
        },
      });

      const userStore = readUser({ slugId });

      const runPromise = userStore.run({ search: searchValue });
      userStore.destroy();
      await runPromise;

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should return undefined from effect when unit was destroyed', () => {
      const userStore = readUser({ slugId });

      userStore.destroy();
      const remove = userStore.effect(vi.fn());

      expect(remove).toBeUndefined();
    });
  });
});
