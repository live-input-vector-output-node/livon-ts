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

type CreateUserAction = Action<UserSlug, CreateUserPayload, User, User>;
type UserEntity = Entity<User>;

describe('action()', () => {
  let runMock = vi.fn();
  let usersEntity: UserEntity;
  let createUser: CreateUserAction;
  let slugId: number;
  let createName: string;
  let createdUserId: string;

  beforeEach(() => {
    slugId = randomNumber();
    createName = randomString({ prefix: 'create-name' });
    createdUserId = randomString({ prefix: 'created-user-id' });

    runMock = vi.fn(async ({ payload }) => {
      return { id: createdUserId, ...payload };
    });

    usersEntity = entity<User>({
      idOf: (value) => value.id,
      ttl: 30_000,
    });

    createUser = action<UserSlug, CreateUserPayload, User, User, User>({
      entity: usersEntity,
      run: runMock,
    });
  });

  describe('happy', () => {
    it('should not call run handler before unit.run is invoked', () => {
      createUser({ slugId });

      expect(runMock).not.toHaveBeenCalled();
    });

    it('should call run handler once when unit.run is invoked once', async () => {
      const createUserStore = createUser({ slugId });

      await createUserStore.run({ name: createName });

      expect(runMock).toHaveBeenCalledTimes(1);
    });

    it('should pass scope to run handler when unit.run is invoked', async () => {
      const createUserStore = createUser({ slugId });

      await createUserStore.run({ name: createName });

      expect(runMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ scope: { slugId } }),
      );
    });

    it('should pass payload to run handler when unit.run is invoked', async () => {
      const createUserStore = createUser({ slugId });

      await createUserStore.run({ name: createName });

      expect(runMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ payload: { name: createName } }),
      );
    });

    it('should expose run function when action unit is created', () => {
      const createUserStore = createUser({ slugId });

      expect(typeof createUserStore.run).toBe('function');
    });

    it('should expose get function when action unit is created', () => {
      const createUserStore = createUser({ slugId });

      expect(typeof createUserStore.get).toBe('function');
    });

    it('should not expose set function when action unit is created', () => {
      const createUserStore = createUser({ slugId });
      const actionApi = createUserStore as unknown as Record<string, unknown>;

      expect(actionApi.set).toBeUndefined();
    });

    it('should expose effect function when action unit is created', () => {
      const createUserStore = createUser({ slugId });

      expect(typeof createUserStore.effect).toBe('function');
    });

    it('should expose stop function when action unit is created', () => {
      const createUserStore = createUser({ slugId });

      expect(typeof createUserStore.stop).toBe('function');
    });

    it('should expose destroy function when action unit is created', () => {
      const createUserStore = createUser({ slugId });

      expect(typeof createUserStore.destroy).toBe('function');
    });

    it('should return action value when run completed', async () => {
      const createUserStore = createUser({ slugId });

      await createUserStore.run({ name: createName });

      expect(createUserStore.get()).toEqual({ id: createdUserId, name: createName });
    });

    it('should not expose set api on action unit at runtime', () => {
      const createUserStore = createUser({ slugId });
      const actionApi = createUserStore as unknown as Record<string, unknown>;

      expect(actionApi.set).toBeUndefined();
    });
  });
});
