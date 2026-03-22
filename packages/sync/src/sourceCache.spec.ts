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

interface MemoryStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

interface SpyMemoryStorage extends MemoryStorage {
  setItemSpy: ReturnType<typeof vi.fn>;
  removeItemSpy: ReturnType<typeof vi.fn>;
}

interface CreateMemoryStorage {
  (): MemoryStorage;
}

interface CreateSpyMemoryStorage {
  (): SpyMemoryStorage;
}

type UnitStatus = 'idle' | 'loading' | 'success' | 'error';

const createMemoryStorage: CreateMemoryStorage = () => {
  const values = new Map<string, string>();

  return {
    getItem: (key) => {
      return values.get(key) ?? null;
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
};

const createSpyMemoryStorage: CreateSpyMemoryStorage = () => {
  const values = new Map<string, string>();
  const setItemSpy = vi.fn((key: string, value: string) => {
    values.set(key, value);
  });
  const removeItemSpy = vi.fn((key: string) => {
    values.delete(key);
  });

  return {
    getItem: (key) => {
      return values.get(key) ?? null;
    },
    setItem: setItemSpy,
    removeItem: removeItemSpy,
    setItemSpy,
    removeItemSpy,
  };
};

describe('source cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('happy', () => {
    it('should write cache asynchronously as fire and forget', async () => {
      const slugId = randomNumber();
      const cacheKey = randomString({ prefix: 'cache-key' });
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });
      const storage = createSpyMemoryStorage();

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const readUser = source<UserSlug, undefined, User, User | null>({
        entity: usersEntity,
        cache: {
          key: cacheKey,
          storage,
          ttl: 'infinity',
        },
        run: async () => undefined,
      });
      const unit = readUser({ slugId });

      unit.set({ id: userId, name: userName });

      expect(storage.setItemSpy).toHaveBeenCalledTimes(0);
      await Promise.resolve();

      expect(storage.setItemSpy).toHaveBeenCalledTimes(1);
    });

    it('should batch cache writes by key when multiple updates happen in one tick', async () => {
      const slugId = randomNumber();
      const cacheKey = randomString({ prefix: 'cache-key' });
      const firstName = randomString({ prefix: 'name' });
      const secondName = randomString({ prefix: 'name' });
      const thirdName = randomString({ prefix: 'name' });
      const storage = createSpyMemoryStorage();

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const readUser = source<UserSlug, undefined, User, User | null>({
        entity: usersEntity,
        cache: {
          key: cacheKey,
          storage,
          ttl: 'infinity',
        },
        run: async () => undefined,
      });
      const unit = readUser({ slugId });

      unit.set({ id: randomString({ prefix: 'user-id' }), name: firstName });
      unit.set({ id: randomString({ prefix: 'user-id' }), name: secondName });
      unit.set({ id: randomString({ prefix: 'user-id' }), name: thirdName });

      expect(storage.setItemSpy).toHaveBeenCalledTimes(0);
      await Promise.resolve();

      expect(storage.setItemSpy).toHaveBeenCalledTimes(1);
    });

    it('should rehydrate value from storage before run when cache ttl is infinity', async () => {
      const slugId = randomNumber();
      const cacheKey = randomString({ prefix: 'cache-key' });
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });
      const user = { id: userId, name: userName };
      const storage = createMemoryStorage();
      const runMock = vi.fn(async ({ upsertOne }) => {
        upsertOne(user);
      });

      const firstEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const firstReadUser = source<UserSlug, undefined, User, User | null>({
        entity: firstEntity,
        cache: {
          key: cacheKey,
          storage,
          ttl: 'infinity',
        },
        run: runMock,
      });
      await firstReadUser({ slugId }).run();
      vi.runAllTimers();

      const secondEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const secondReadUser = source<UserSlug, undefined, User, User | null>({
        entity: secondEntity,
        cache: {
          key: cacheKey,
          storage,
          ttl: 'infinity',
        },
        run: runMock,
      });

      const secondUnit = secondReadUser({ slugId });

      expect(secondUnit.get()).toEqual(user);
      expect(runMock).toHaveBeenCalledTimes(1);
    });

    it('should skip loading status on first run after rehydrate', async () => {
      const slugId = randomNumber();
      const cacheKey = randomString({ prefix: 'cache-key' });
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });
      const user = { id: userId, name: userName };
      const storage = createMemoryStorage();
      const runMock = vi.fn(async ({ upsertOne }) => {
        upsertOne(user);
      });

      const firstEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const firstReadUser = source<UserSlug, undefined, User, User | null>({
        entity: firstEntity,
        cache: {
          key: cacheKey,
          storage,
          ttl: 'infinity',
        },
        run: runMock,
      });
      await firstReadUser({ slugId }).run();
      vi.runAllTimers();

      const secondEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const secondReadUser = source<UserSlug, undefined, User, User | null>({
        entity: secondEntity,
        cache: {
          key: cacheKey,
          storage,
          ttl: 'infinity',
        },
        run: runMock,
      });
      const secondUnit = secondReadUser({ slugId });
      const statuses: UnitStatus[] = [];

      secondUnit.effect((snapshot) => {
        statuses.push(snapshot.status);
      });
      await secondUnit.run();

      expect(statuses).not.toContain('loading');
      expect(runMock).toHaveBeenCalledTimes(2);
    });

    it('should ignore stale cache when ttl is exceeded', async () => {
      const slugId = randomNumber();
      const cacheKey = randomString({ prefix: 'cache-key' });
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });
      const user = { id: userId, name: userName };
      const storage = createMemoryStorage();
      const runMock = vi.fn(async ({ upsertOne }) => {
        upsertOne(user);
      });

      const firstEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const firstReadUser = source<UserSlug, undefined, User, User | null>({
        entity: firstEntity,
        cache: {
          key: cacheKey,
          storage,
          ttl: 1_000,
        },
        run: runMock,
      });
      await firstReadUser({ slugId }).run();
      vi.advanceTimersByTime(1_001);

      const secondEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const secondReadUser = source<UserSlug, undefined, User, User | null>({
        entity: secondEntity,
        cache: {
          key: cacheKey,
          storage,
          ttl: 1_000,
        },
        run: runMock,
      });

      const secondUnit = secondReadUser({ slugId });

      expect(secondUnit.get()).toBeNull();
      expect(runMock).toHaveBeenCalledTimes(1);
    });

    it('should fallback to entity cache ttl when source cache ttl is omitted', async () => {
      const slugId = randomNumber();
      const cacheKey = randomString({ prefix: 'cache-key' });
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });
      const user = { id: userId, name: userName };
      const storage = createMemoryStorage();
      const runMock = vi.fn(async ({ upsertOne }) => {
        upsertOne(user);
      });

      const firstEntity = entity<User>({
        idOf: (value) => value.id,
        cache: {
          key: cacheKey,
          storage,
          ttl: 1_000,
        },
      });
      const firstReadUser = source<UserSlug, undefined, User, User | null>({
        entity: firstEntity,
        run: runMock,
      });
      await firstReadUser({ slugId }).run();
      vi.advanceTimersByTime(999);

      const secondEntity = entity<User>({
        idOf: (value) => value.id,
        cache: {
          key: cacheKey,
          storage,
          ttl: 1_000,
        },
      });
      const secondReadUser = source<UserSlug, undefined, User, User | null>({
        entity: secondEntity,
        run: runMock,
      });

      expect(secondReadUser({ slugId }).get()).toEqual(user);
      expect(runMock).toHaveBeenCalledTimes(1);
    });

    it('should use source cache ttl over entity cache ttl when both are provided', async () => {
      const slugId = randomNumber();
      const cacheKey = randomString({ prefix: 'cache-key' });
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });
      const user = { id: userId, name: userName };
      const storage = createMemoryStorage();
      const runMock = vi.fn(async ({ upsertOne }) => {
        upsertOne(user);
      });

      const firstEntity = entity<User>({
        idOf: (value) => value.id,
        cache: {
          key: cacheKey,
          storage,
          ttl: 'infinity',
        },
      });
      const firstReadUser = source<UserSlug, undefined, User, User | null>({
        entity: firstEntity,
        cache: {
          ttl: 1_000,
        },
        run: runMock,
      });
      await firstReadUser({ slugId }).run();
      vi.advanceTimersByTime(1_001);

      const secondEntity = entity<User>({
        idOf: (value) => value.id,
        cache: {
          key: cacheKey,
          storage,
          ttl: 'infinity',
        },
      });
      const secondReadUser = source<UserSlug, undefined, User, User | null>({
        entity: secondEntity,
        cache: {
          ttl: 1_000,
        },
        run: runMock,
      });

      expect(secondReadUser({ slugId }).get()).toBeNull();
      expect(runMock).toHaveBeenCalledTimes(1);
    });
  });
});
