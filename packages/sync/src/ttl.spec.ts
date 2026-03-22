import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { entity } from './entity.js';
import { source } from './source.js';
import { randomNumber, randomString } from './testing/randomData.js';

interface User {
  id: string;
  name: string;
}

interface UserSlug {
  slugId: number;
}

type UsersResult = readonly User[];
type ReadUsersApi = () => Promise<readonly User[]>;

describe('ttl rules', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('happy', () => {
    it('should keep source cache hot until entity ttl when source ttl is omitted', async () => {
      const slugId = randomNumber();
      const expectedUser = {
        id: randomString({ prefix: 'user-id' }),
        name: randomString({ prefix: 'user-name' }),
      };
      const readUsersApi = vi.fn(async () => [expectedUser]);

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        ttl: 30_000,
      });

      const readUsers = source<UserSlug, undefined, User, UsersResult, UsersResult>({
        entity: usersEntity,
        run: async ({ upsertMany }) => {
          const users = await readUsersApi();
          upsertMany(users);
        },
      });

      const usersStore = readUsers({ slugId });

      await usersStore.run();
      vi.advanceTimersByTime(29_999);
      await usersStore.run();

      expect(readUsersApi).toHaveBeenCalledTimes(1);
    });

    it('should reload source after entity ttl when source ttl is omitted', async () => {
      const slugId = randomNumber();
      const expectedUser = {
        id: randomString({ prefix: 'user-id' }),
        name: randomString({ prefix: 'user-name' }),
      };
      const readUsersApi = vi.fn(async () => [expectedUser]);

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        ttl: 30_000,
      });

      const readUsers = source<UserSlug, undefined, User, UsersResult, UsersResult>({
        entity: usersEntity,
        run: async ({ upsertMany }) => {
          const users = await readUsersApi();
          upsertMany(users);
        },
      });

      const usersStore = readUsers({ slugId });

      await usersStore.run();
      vi.advanceTimersByTime(30_001);
      await usersStore.run();

      expect(readUsersApi).toHaveBeenCalledTimes(2);
    });

    it('should keep entity record when only source ttl expires', async () => {
      const slugId = randomNumber();
      const expectedUser = {
        id: randomString({ prefix: 'user-id' }),
        name: randomString({ prefix: 'user-name' }),
      };
      const readUsersApi = vi.fn(async () => [expectedUser]);

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        ttl: 60_000,
      });

      const readUsers = source<UserSlug, undefined, User, UsersResult, UsersResult>({
        entity: usersEntity,
        ttl: 10_000,
        run: async ({ upsertMany }) => {
          const users = await readUsersApi();
          upsertMany(users);
        },
      });

      const usersStore = readUsers({ slugId });

      await usersStore.run();
      vi.advanceTimersByTime(10_001);

      expect(usersEntity.getById(expectedUser.id)).toEqual(expectedUser);
    });

    it('should reload source when source ttl expires before entity ttl', async () => {
      const slugId = randomNumber();
      const expectedUser = {
        id: randomString({ prefix: 'user-id' }),
        name: randomString({ prefix: 'user-name' }),
      };
      const readUsersApi = vi.fn(async () => [expectedUser]);

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        ttl: 60_000,
      });

      const readUsers = source<UserSlug, undefined, User, UsersResult, UsersResult>({
        entity: usersEntity,
        ttl: 10_000,
        run: async ({ upsertMany }) => {
          const users = await readUsersApi();
          upsertMany(users);
        },
      });

      const usersStore = readUsers({ slugId });

      await usersStore.run();
      vi.advanceTimersByTime(10_001);
      await usersStore.run();

      expect(readUsersApi).toHaveBeenCalledTimes(2);
    });

    it('should keep stale value visible after source ttl expires until next run', async () => {
      const slugId = randomNumber();
      const userId = randomString({ prefix: 'user-id' });
      const firstName = randomString({ prefix: 'first-name' });
      const secondName = randomString({ prefix: 'second-name' });
      const firstUser = { id: userId, name: firstName };
      const secondUser = { id: userId, name: secondName };
      const readUsersApi = vi
        .fn<ReadUsersApi>()
        .mockResolvedValueOnce([firstUser])
        .mockResolvedValueOnce([secondUser]);

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        ttl: 60_000,
      });

      const readUsers = source<UserSlug, undefined, User, UsersResult, UsersResult>({
        entity: usersEntity,
        ttl: 10_000,
        run: async ({ upsertMany }) => {
          const users = await readUsersApi();
          upsertMany(users);
        },
      });

      const usersStore = readUsers({ slugId });

      await usersStore.run();
      vi.advanceTimersByTime(10_001);

      expect(readUsersApi).toHaveBeenCalledTimes(1);
      expect(usersStore.get()).toEqual([firstUser]);
    });

    it('should replace stale value on next run after source ttl expires', async () => {
      const slugId = randomNumber();
      const userId = randomString({ prefix: 'user-id' });
      const firstName = randomString({ prefix: 'first-name' });
      const secondName = randomString({ prefix: 'second-name' });
      const firstUser = { id: userId, name: firstName };
      const secondUser = { id: userId, name: secondName };
      const readUsersApi = vi
        .fn<ReadUsersApi>()
        .mockResolvedValueOnce([firstUser])
        .mockResolvedValueOnce([secondUser]);

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        ttl: 60_000,
      });

      const readUsers = source<UserSlug, undefined, User, UsersResult, UsersResult>({
        entity: usersEntity,
        ttl: 10_000,
        run: async ({ upsertMany }) => {
          const users = await readUsersApi();
          upsertMany(users);
        },
      });

      const usersStore = readUsers({ slugId });

      await usersStore.run();
      vi.advanceTimersByTime(10_001);
      await usersStore.run();

      expect(readUsersApi).toHaveBeenCalledTimes(2);
      expect(usersStore.get()).toEqual([secondUser]);
    });

    it('should keep source value while source ttl is active even if entity ttl is shorter', async () => {
      const slugId = randomNumber();
      const expectedUser = {
        id: randomString({ prefix: 'user-id' }),
        name: randomString({ prefix: 'user-name' }),
      };
      const readUsersApi = vi.fn(async () => [expectedUser]);

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        ttl: 5_000,
      });

      const readUsers = source<UserSlug, undefined, User, UsersResult, UsersResult>({
        entity: usersEntity,
        ttl: 30_000,
        run: async ({ upsertMany }) => {
          const users = await readUsersApi();
          upsertMany(users);
        },
      });

      const usersStore = readUsers({ slugId });

      await usersStore.run();
      vi.advanceTimersByTime(5_001);

      expect(usersStore.get()).toEqual([expectedUser]);
    });

    it('should not reload before source ttl when entity ttl is shorter', async () => {
      const slugId = randomNumber();
      const expectedUser = {
        id: randomString({ prefix: 'user-id' }),
        name: randomString({ prefix: 'user-name' }),
      };
      const readUsersApi = vi.fn(async () => [expectedUser]);

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        ttl: 5_000,
      });

      const readUsers = source<UserSlug, undefined, User, UsersResult, UsersResult>({
        entity: usersEntity,
        ttl: 30_000,
        run: async ({ upsertMany }) => {
          const users = await readUsersApi();
          upsertMany(users);
        },
      });

      const usersStore = readUsers({ slugId });

      await usersStore.run();
      vi.advanceTimersByTime(5_001);
      await usersStore.run();

      expect(readUsersApi).toHaveBeenCalledTimes(1);
    });

    it('should reload after source ttl when entity ttl is shorter', async () => {
      const slugId = randomNumber();
      const expectedUser = {
        id: randomString({ prefix: 'user-id' }),
        name: randomString({ prefix: 'user-name' }),
      };
      const readUsersApi = vi.fn(async () => [expectedUser]);

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        ttl: 5_000,
      });

      const readUsers = source<UserSlug, undefined, User, UsersResult, UsersResult>({
        entity: usersEntity,
        ttl: 30_000,
        run: async ({ upsertMany }) => {
          const users = await readUsersApi();
          upsertMany(users);
        },
      });

      const usersStore = readUsers({ slugId });

      await usersStore.run();
      vi.advanceTimersByTime(30_001);
      await usersStore.run();

      expect(readUsersApi).toHaveBeenCalledTimes(2);
    });
  });
});
