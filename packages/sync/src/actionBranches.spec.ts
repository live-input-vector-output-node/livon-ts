import { beforeEach, describe, expect, it, vi } from 'vitest';

import { action, type Action } from './action.js';
import { entity, type Entity } from './entity.js';
import { randomNumber, randomString } from './testing/randomData.js';

interface User {
  id: string;
  name: string;
}

interface UserSlug {
  slugId: number;
}

interface CreateUserPayload {
  name: string;
}

interface MessageMeta {
  severity: string;
  text: string;
}

interface Release {
  (): void;
}

type UnitStatus = 'idle' | 'loading' | 'success' | 'error';
type UserEntity = Entity<User>;
type CreateUserAction = Action<UserSlug, CreateUserPayload, User | null, User>;

describe('action() branches', () => {
  let usersEntity: UserEntity;
  let createUser: CreateUserAction;
  let runMock = vi.fn();
  let slugId: number;
  let createName: string;
  let createdUserId: string;

  beforeEach(() => {
    slugId = randomNumber();
    createName = randomString({ prefix: 'create-name' });
    createdUserId = randomString({ prefix: 'created-user-id' });

    usersEntity = entity<User>({
      idOf: (value) => value.id,
      ttl: 30_000,
    });

    runMock = vi.fn(async ({ payload, upsertOne }) => {
      upsertOne({ id: createdUserId, name: payload.name });
    });

    createUser = action<UserSlug, CreateUserPayload, User, User | null, User>({
      entity: usersEntity,
      run: runMock,
    });
  });

  describe('happy', () => {
    it('should return same unit instance when scope is identical', () => {
      const firstUnit = createUser({ slugId });
      const secondUnit = createUser({ slugId });

      expect(firstUnit).toBe(secondUnit);
    });

    it('should run handler once when run is called concurrently', async () => {
      let release: Release | undefined;
      runMock = vi.fn(async ({ payload, upsertOne }) => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        upsertOne({ id: createdUserId, name: payload.name });
      });

      createUser = action<UserSlug, CreateUserPayload, User, User | null, User>({
        entity: usersEntity,
        run: runMock,
      });

      const unit = createUser({ slugId });
      const firstRun = unit.run({ name: createName });
      const secondRun = unit.run({ name: createName });

      release?.();
      await Promise.all([firstRun, secondRun]);

      expect(runMock).toHaveBeenCalledTimes(1);
    });

    it('should expose latest meta when run calls setMeta', async () => {
      const meta: MessageMeta = {
        severity: randomString({ prefix: 'severity' }),
        text: randomString({ prefix: 'meta-text' }),
      };

      createUser = action<UserSlug, CreateUserPayload, User, User | null, User>({
        entity: usersEntity,
        run: async ({ payload, setMeta, upsertOne }) => {
          setMeta(meta);
          upsertOne({ id: createdUserId, name: payload.name });
        },
      });

      const unit = createUser({ slugId });
      const metas: unknown[] = [];

      unit.effect((snapshot) => {
        metas.push(snapshot.meta);
      });

      await unit.run({ name: createName });

      expect(metas).toContainEqual(meta);
    });

    it('should return many-mode value when run calls upsertMany', async () => {
      const secondUserId = randomString({ prefix: 'second-user-id' });
      const secondUserName = randomString({ prefix: 'second-user-name' });

      const createManyUsers = action<
        UserSlug,
        CreateUserPayload,
        User,
        readonly User[],
        readonly User[]
      >({
        entity: usersEntity,
        run: async ({ payload, upsertMany }) => {
          upsertMany([
            { id: createdUserId, name: payload.name },
            { id: secondUserId, name: secondUserName },
          ]);
        },
      });

      const unit = createManyUsers({ slugId });

      await unit.run({ name: createName });

      expect(unit.get()).toEqual([
        { id: createdUserId, name: createName },
        { id: secondUserId, name: secondUserName },
      ]);
    });

    it('should remove records when run calls removeOne and removeMany', async () => {
      const firstUserId = randomString({ prefix: 'first-user-id' });
      const secondUserId = randomString({ prefix: 'second-user-id' });
      const thirdUserId = randomString({ prefix: 'third-user-id' });
      const firstUserName = randomString({ prefix: 'first-user-name' });
      const secondUserName = randomString({ prefix: 'second-user-name' });
      const thirdUserName = randomString({ prefix: 'third-user-name' });

      const removeUsers = action<
        UserSlug,
        CreateUserPayload,
        User,
        readonly User[],
        readonly User[]
      >({
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

      const unit = removeUsers({ slugId });

      await unit.run({ name: createName });

      expect(unit.get()).toEqual([{ id: thirdUserId, name: thirdUserName }]);
    });

    it('should read current value when run calls getValue', async () => {
      let valueFromRun: User | null = { id: randomString({ prefix: 'seed-id' }), name: randomString({ prefix: 'seed-name' }) };

      createUser = action<UserSlug, CreateUserPayload, User, User | null, User>({
        entity: usersEntity,
        run: async ({ getValue, payload, upsertOne }) => {
          valueFromRun = getValue();
          upsertOne({ id: createdUserId, name: payload.name });
        },
      });

      const unit = createUser({ slugId });

      await unit.run({ name: createName });

      expect(valueFromRun).toBeNull();
    });

    it('should keep explicit run return value when run returns raw result', async () => {
      const rawResult: User = {
        id: randomString({ prefix: 'raw-id' }),
        name: randomString({ prefix: 'raw-name' }),
      };

      createUser = action<UserSlug, CreateUserPayload, User, User | null, User>({
        entity: usersEntity,
        run: async () => {
          return rawResult;
        },
      });

      const unit = createUser({ slugId });

      await unit.run({ name: createName });

      expect(unit.get()).toEqual(rawResult);
    });

    it('should remove effect listener when cleanup is called', () => {
      const unit = createUser({ slugId });
      const listener = vi.fn();
      const remove = unit.effect(listener);
      const setUser: User = {
        id: randomString({ prefix: 'set-id' }),
        name: randomString({ prefix: 'set-name' }),
      };

      remove?.();
      unit.set(setUser);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('sad', () => {
    it('should not call run handler when run is invoked after destroy', async () => {
      const unit = createUser({ slugId });

      unit.destroy();
      await unit.run({ name: createName });

      expect(runMock).not.toHaveBeenCalled();
    });

    it('should emit error status when run throws', async () => {
      const errorMessage = randomString({ prefix: 'action-error' });
      const statuses: UnitStatus[] = [];

      createUser = action<UserSlug, CreateUserPayload, User, User | null, User>({
        entity: usersEntity,
        run: async () => {
          throw new Error(errorMessage);
        },
      });

      const unit = createUser({ slugId });

      unit.effect((snapshot) => {
        statuses.push(snapshot.status);
      });

      await expect(unit.run({ name: createName })).rejects.toThrow(errorMessage);

      expect(statuses).toContain('error');
    });

    it('should ignore set when unit was destroyed', () => {
      const unit = createUser({ slugId });
      const setUser: User = {
        id: randomString({ prefix: 'set-id' }),
        name: randomString({ prefix: 'set-name' }),
      };

      unit.destroy();
      unit.set(setUser);

      expect(unit.get()).toBeNull();
    });

    it('should return undefined from effect when unit was destroyed', () => {
      const unit = createUser({ slugId });

      unit.destroy();
      const remove = unit.effect(vi.fn());

      expect(remove).toBeUndefined();
    });

    it('should call cleanup only once when destroy is called repeatedly', async () => {
      const cleanup = vi.fn();
      let release: Release | undefined;

      createUser = action<UserSlug, CreateUserPayload, User, User | null, User>({
        entity: usersEntity,
        run: async () => {
          await new Promise<void>((resolve) => {
            release = resolve;
          });

          return () => {
            cleanup();
          };
        },
      });

      const unit = createUser({ slugId });

      const runPromise = unit.run({ name: createName });
      unit.destroy();
      unit.destroy();
      release?.();
      await runPromise;

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should call cleanup immediately when cleanup resolves after destroy', async () => {
      const cleanup = vi.fn();

      createUser = action<UserSlug, CreateUserPayload, User, User | null, User>({
        entity: usersEntity,
        run: async () => {
          await Promise.resolve();

          return () => {
            cleanup();
          };
        },
      });

      const unit = createUser({ slugId });

      const runPromise = unit.run({ name: createName });
      unit.destroy();
      await runPromise;

      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });
});
