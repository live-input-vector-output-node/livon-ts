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

    runMock = vi.fn(async ({ payload }) => {
      return { id: payload.search, name: payload.search };
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
        run: async ({ getValue, payload }) => {
          valueFromRun = getValue();
          return { id: payload.search, name: payload.search };
        },
      });

      const userStore = readUser({ slugId });

      await userStore.run({ search: searchValue });

      expect(valueFromRun).toBeNull();
    });

    it('should use direct run return value when no previous entity value exists', async () => {
      const returnedUser: User = {
        id: randomString({ prefix: 'returned-id' }),
        name: randomString({ prefix: 'returned-name' }),
      };

      readUser = source<UserSlug, SearchPayload, User, User | null, User>({
        entity: usersEntity,
        run: async () => {
          return returnedUser;
        },
      });

      const userStore = readUser({ slugId });

      await expect(userStore.run({ search: searchValue })).resolves.toEqual(returnedUser);
      expect(userStore.get()).toEqual(returnedUser);
    });

    it('should remove effect listener when cleanup is called', async () => {
      const userStore = readUser({ slugId });
      const listener = vi.fn();
      const remove = userStore.effect(listener);

      remove?.();
      await userStore.run({ search: searchValue });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should use returned many-mode value when run resolves an entity list', async () => {
      const thirdUserId = randomString({ prefix: 'third-user-id' });
      const thirdUserName = randomString({ prefix: 'third-user-name' });

      const readUsers = source<UserSlug, SearchPayload, User, readonly User[], readonly User[]>({
        entity: usersEntity,
        run: async () => {
          return [{ id: thirdUserId, name: thirdUserName }];
        },
      });

      const usersStore = readUsers({ slugId });

      await usersStore.run({ search: searchValue });

      expect(usersStore.get()).toEqual([{ id: thirdUserId, name: thirdUserName }]);
    });

    it('should remove orphaned entities when many-mode run result replaces previous ids', async () => {
      const firstUserId = randomString({ prefix: 'first-user-id' });
      const secondUserId = randomString({ prefix: 'second-user-id' });
      const firstUserName = randomString({ prefix: 'first-user-name' });
      const secondUserName = randomString({ prefix: 'second-user-name' });
      let runCount = 0;
      const replaceUsersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      const readUsers = source<UserSlug, SearchPayload, User, readonly User[]>({
        entity: replaceUsersEntity,
        run: async () => {
          runCount += 1;
          if (runCount === 1) {
            return [
              { id: firstUserId, name: firstUserName },
              { id: secondUserId, name: secondUserName },
            ];
          }

          return [{ id: secondUserId, name: secondUserName }];
        },
      });

      const usersStore = readUsers({ slugId });

      await usersStore.run({ search: searchValue });
      expect(replaceUsersEntity.getById(firstUserId)).toEqual({
        id: firstUserId,
        name: firstUserName,
      });

      await usersStore.run({ search: randomString({ prefix: 'next-search' }) });

      expect(usersStore.get()).toEqual([{ id: secondUserId, name: secondUserName }]);
      expect(replaceUsersEntity.getById(firstUserId)).toBeUndefined();
    });

    it('should reset source state back to initial value', async () => {
      const userStore = readUser({ slugId });

      await userStore.run({ search: searchValue });
      expect(userStore.get()).toEqual({ id: searchValue, name: searchValue });

      userStore.reset();

      expect(userStore.get()).toBeNull();
    });

    it('should unlock source mode after reset so the next run can set a different mode', async () => {
      const firstUserId = randomString({ prefix: 'first-user-id' });
      const firstUserName = randomString({ prefix: 'first-user-name' });
      const secondUserId = randomString({ prefix: 'second-user-id' });
      const secondUserName = randomString({ prefix: 'second-user-name' });
      let useManyMode = false;

      const readSwitchable = source<
        UserSlug,
        SearchPayload,
        User,
        User | readonly User[] | null
      >({
        entity: usersEntity,
        run: async () => {
          if (!useManyMode) {
            return {
              id: firstUserId,
              name: firstUserName,
            };
          }

          return [
            {
              id: firstUserId,
              name: firstUserName,
            },
            {
              id: secondUserId,
              name: secondUserName,
            },
          ];
        },
      });

      const userStore = readSwitchable({ slugId });
      await userStore.run({ search: searchValue });

      userStore.reset();
      useManyMode = true;
      await userStore.run({ search: searchValue });

      expect(userStore.get()).toEqual([
        {
          id: firstUserId,
          name: firstUserName,
        },
        {
          id: secondUserId,
          name: secondUserName,
        },
      ]);
    });

    it('should allow run context to call reset and restore initial state', async () => {
      const runCreatedUserId = randomString({ prefix: 'run-created-user-id' });
      let hasResetMethod = false;

      const readWithReset = source<UserSlug, SearchPayload, User, User | null>({
        entity: usersEntity,
        run: async (context) => {
          hasResetMethod = typeof context.reset === 'function';
          context.upsertOne({
            id: runCreatedUserId,
            name: randomString({ prefix: 'run-created-user-name' }),
          });
          context.reset();
        },
      });

      const userStore = readWithReset({ slugId });
      await userStore.run({ search: searchValue });

      expect(hasResetMethod).toBe(true);
      expect(userStore.get()).toBeNull();
    });
  });

  describe('sad', () => {
    it('should throw semantic error when run switches a locked scope mode from one to many', async () => {
      const firstUserId = randomString({ prefix: 'first-user-id' });
      const secondUserId = randomString({ prefix: 'second-user-id' });
      const secondUserName = randomString({ prefix: 'second-user-name' });
      let returnsMany = false;

      const readUserWithModeSwitch = source<
        UserSlug,
        SearchPayload,
        User,
        User | readonly User[] | null
      >({
        entity: usersEntity,
        run: async ({ payload }) => {
          if (!returnsMany) {
            return {
              id: firstUserId,
              name: payload.search,
            };
          }

          return [
            {
              id: firstUserId,
              name: payload.search,
            },
            {
              id: secondUserId,
              name: secondUserName,
            },
          ];
        },
      });

      const userStore = readUserWithModeSwitch({ slugId });

      await userStore.run({ search: searchValue });
      returnsMany = true;

      await expect(
        userStore.run({ search: randomString({ prefix: 'next-search' }) }),
      ).rejects.toThrow("Cannot switch to 'many' via run() result array.");
    });

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
