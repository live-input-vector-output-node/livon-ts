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
type ReadUserSource = Source<UserSlug, SearchPayload, User | null>;

const hasStringCacheState = (context: unknown): context is { readonly cacheState: string } => {
  if (typeof context !== 'object' || context === null) {
    return false;
  }

  if (!Object.prototype.hasOwnProperty.call(context, 'cacheState')) {
    return false;
  }

  return typeof Reflect.get(context, 'cacheState') === 'string';
};

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

    readUser = source<UserSlug, SearchPayload, User | null>({
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

      readUser = source<UserSlug, SearchPayload, User | null>({
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

      readUser = source<UserSlug, SearchPayload, User | null>({
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

      const readUsers = source<UserSlug, SearchPayload, readonly User[]>({
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

      const readUsers = source<UserSlug, SearchPayload, readonly User[]>({
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

    it('should reset source status, meta, and context back to initial values', async () => {
      const metaValue = { severity: 'info', text: randomString({ prefix: 'meta-text' }) };

      const readWithMeta = source<UserSlug, SearchPayload, User | null>({
        entity: usersEntity,
        run: async ({ payload, setMeta }) => {
          setMeta(metaValue);
          return { id: payload.search, name: payload.search };
        },
      });

      const userStore = readWithMeta({ slugId });
      await userStore.run({ search: searchValue });

      const snapshotsAfterReset: Array<{ status: string; meta: unknown; cacheState: string }> = [];
      userStore.effect((snapshot) => {
        snapshotsAfterReset.push({
          status: snapshot.status,
          meta: snapshot.meta,
          cacheState: hasStringCacheState(snapshot.context) ? snapshot.context.cacheState : 'disabled',
        });
      });

      userStore.reset();

      expect(snapshotsAfterReset).toHaveLength(1);
      expect(snapshotsAfterReset[0]).toEqual({
        status: 'idle',
        meta: null,
        cacheState: 'disabled',
      });
    });

    it('should unlock source mode after reset so the next run can set a different mode', async () => {
      const firstUserId = randomString({ prefix: 'first-user-id' });
      const firstUserName = randomString({ prefix: 'first-user-name' });
      const secondUserId = randomString({ prefix: 'second-user-id' });
      const secondUserName = randomString({ prefix: 'second-user-name' });
      let useManyMode = false;

      const readSwitchable = source<UserSlug, SearchPayload, User | readonly User[] | null>({
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

      const readWithReset = source<UserSlug, SearchPayload, User | null>({
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

    it('should clear stored payload when source unit is reset', async () => {
      const capturedPayloads: (SearchPayload | undefined)[] = [];

      const readWithOptionalPayload = source<UserSlug, SearchPayload | undefined, User | null>({
        entity: usersEntity,
        run: async ({ payload }) => {
          capturedPayloads.push(payload);
          return null;
        },
      });

      const userStore = readWithOptionalPayload({ slugId });

      await userStore.run({ search: searchValue });
      userStore.reset();
      await userStore.run();

      expect(capturedPayloads).toEqual([
        { search: searchValue },
        undefined,
      ]);
    });

    it('should allow run context to call set and hard-replace many-mode source state', async () => {
      const firstUserId = randomString({ prefix: 'first-user-id' });
      const secondUserId = randomString({ prefix: 'second-user-id' });
      const secondUserName = randomString({ prefix: 'second-user-name' });
      let runCount = 0;
      let hasSetMethod = false;

      const readUsers = source<UserSlug, SearchPayload, readonly User[]>({
        entity: usersEntity,
        defaultValue: [],
        run: async ({ payload, set }) => {
          runCount += 1;
          hasSetMethod = typeof set === 'function';

          if (runCount === 1) {
            set([
              {
                id: firstUserId,
                name: payload.search,
              },
              {
                id: secondUserId,
                name: secondUserName,
              },
            ]);
            return;
          }

          set((previousUsers) => {
            return previousUsers.filter((entry) => entry.id === secondUserId);
          });
        },
      });

      const usersStore = readUsers({ slugId });

      await usersStore.run({ search: searchValue });
      expect(usersStore.get()).toEqual([
        {
          id: firstUserId,
          name: searchValue,
        },
        {
          id: secondUserId,
          name: secondUserName,
        },
      ]);

      await usersStore.run({ search: randomString({ prefix: 'next-search' }) });

      expect(hasSetMethod).toBe(true);
      expect(usersStore.get()).toEqual([
        {
          id: secondUserId,
          name: secondUserName,
        },
      ]);
    });

    it('should allow run context set updater to derive next one-mode state from previous value', async () => {
      const initialUserName = randomString({ prefix: 'initial-user-name' });
      const updatedUserName = randomString({ prefix: 'updated-user-name' });
      const stableUserId = randomString({ prefix: 'stable-user-id' });
      let runCount = 0;

      const readUserWithSetter = source<UserSlug, SearchPayload, User | null>({
        entity: usersEntity,
        run: async ({ set }) => {
          runCount += 1;

          if (runCount === 1) {
            set({
              id: stableUserId,
              name: initialUserName,
            });
            return;
          }

          set((previousUser) => {
            if (!previousUser) {
              return previousUser;
            }

            return {
              ...previousUser,
              name: updatedUserName,
            };
          });
        },
      });

      const userStore = readUserWithSetter({ slugId });

      await userStore.run({ search: searchValue });
      expect(userStore.get()).toEqual({
        id: stableUserId,
        name: initialUserName,
      });

      await userStore.run({ search: randomString({ prefix: 'next-search' }) });
      expect(userStore.get()).toEqual({
        id: stableUserId,
        name: updatedUserName,
      });
    });

    it('should notify listeners immediately when run context set updates value before run resolves', async () => {
      const pendingUserId = randomString({ prefix: 'pending-user-id' });
      let releaseRun = () => undefined;
      let hasReleaseRun = false;
      let runResolved = false;
      const observedValues: Array<User | null> = [];

      const readWithPendingRun = source<UserSlug, SearchPayload, User | null>({
        entity: usersEntity,
        run: async ({ payload, set }) => {
          set({
            id: payload.search,
            name: payload.search,
          });
          await new Promise<void>((resolve) => {
            hasReleaseRun = true;
            releaseRun = () => {
              resolve();
            };
          });
        },
      });

      const userStore = readWithPendingRun({ slugId });
      userStore.effect((snapshot) => {
        observedValues.push(snapshot.value);
      });

      const runPromise = userStore
        .run({ search: pendingUserId })
        .then(() => {
          runResolved = true;
        });
      await Promise.resolve();

      expect(runResolved).toBe(false);
      expect(hasReleaseRun).toBe(true);
      expect(observedValues.some((value) => value?.id === pendingUserId)).toBe(true);
      releaseRun();
      await runPromise;
    });
  });

  describe('sad', () => {
    it('should throw semantic error when run switches a locked scope mode from one to many', async () => {
      const firstUserId = randomString({ prefix: 'first-user-id' });
      const secondUserId = randomString({ prefix: 'second-user-id' });
      const secondUserName = randomString({ prefix: 'second-user-name' });
      let returnsMany = false;

      const readUserWithModeSwitch = source<UserSlug, SearchPayload, User | readonly User[] | null>({
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

      readUser = source<UserSlug, SearchPayload, User | null>({
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
