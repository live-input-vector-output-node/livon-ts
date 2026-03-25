import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { entity } from './entity.js';
import { resolveCacheKey, serializeSourceCacheRecord } from './source/helpers.js';
import { source } from './source.js';
import { randomNumber, randomString } from './testing/randomData.js';
import { serializeKey, type UnitStatus } from './utils/index.js';

interface User {
  id: string;
  name: string;
}

interface UserSlug {
  slugId: number;
}

interface StructuredCacheValue {
  createdAt: Date;
  total: bigint;
  notANumber: number;
  tags: Set<string>;
  lookup: Map<string, number>;
  matcher: RegExp;
  optional: undefined;
}

interface StructuredUser {
  id: string;
  name: string;
  profile: StructuredCacheValue;
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

interface SeedSourceCacheInput<TEntity extends object> {
  storage: MemoryStorage;
  scope: UserSlug;
  payload?: unknown;
  mode: 'one' | 'many';
  entities: readonly TEntity[];
  writtenAt: number;
  sourceCacheKey?: string;
  entityCacheKey?: string;
}

interface BuildSourceCacheRecordKeyInput {
  scope: UserSlug;
  payload?: unknown;
  mode: 'one' | 'many';
  sourceCacheKey?: string;
  entityCacheKey?: string;
}

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

const buildSourceCacheRecordKey = ({
  scope,
  payload,
  mode,
  sourceCacheKey,
  entityCacheKey,
}: BuildSourceCacheRecordKeyInput): string => {
  const sourceKey = serializeKey({
    mode,
  });
  const cachePrefix = resolveCacheKey({
    sourceCache: sourceCacheKey
      ? {
        key: sourceCacheKey,
      }
      : undefined,
    entityCache: entityCacheKey
      ? {
        key: entityCacheKey,
      }
      : undefined,
    sourceKey,
  });
  const unitKey = serializeKey(scope);
  const payloadKey = serializeKey(payload);

  return `${cachePrefix}:${unitKey}:${payloadKey}`;
};

const seedSourceCache = <TEntity extends object>({
  storage,
  scope,
  payload,
  mode,
  entities,
  writtenAt,
  sourceCacheKey,
  entityCacheKey,
}: SeedSourceCacheInput<TEntity>): void => {
  const sourceCacheRecordKey = buildSourceCacheRecordKey({
    scope,
    payload,
    mode,
    sourceCacheKey,
    entityCacheKey,
  });
  const cacheRecord = serializeSourceCacheRecord({
    mode,
    entities,
    writtenAt,
  });

  storage.setItem(sourceCacheRecordKey, cacheRecord);
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
      const readUser = source<UserSlug, User, User, User | null>({
        entity: usersEntity,
        cache: {
          key: cacheKey,
          storage,
          ttl: 'infinity',
        },
        run: async ({ payload }) => {
          return payload;
        },
      });
      const unit = readUser({ slugId });

      const runPromise = unit.run({ id: userId, name: userName });

      expect(storage.setItemSpy).toHaveBeenCalledTimes(0);
      await runPromise;
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
      const readUser = source<UserSlug, User, User, User | null>({
        entity: usersEntity,
        cache: {
          key: cacheKey,
          storage,
          ttl: 'infinity',
        },
        run: async ({ payload }) => {
          return payload;
        },
      });
      const unit = readUser({ slugId });

      const runPromises = [
        unit.run({ id: randomString({ prefix: 'user-id' }), name: firstName }),
        unit.run({ id: randomString({ prefix: 'user-id' }), name: secondName }),
        unit.run({ id: randomString({ prefix: 'user-id' }), name: thirdName }),
      ];

      expect(storage.setItemSpy).toHaveBeenCalledTimes(0);
      await Promise.all(runPromises);
      await Promise.resolve();

      expect(storage.setItemSpy).toHaveBeenCalledTimes(1);
    });

    it('should evict least recently used cache record when lru max entries is reached', async () => {
      const slugId = randomNumber();
      const cacheKey = randomString({ prefix: 'cache-key' });
      const storage = createMemoryStorage();

      const payloadOne = { query: randomString({ prefix: 'query-one' }) };
      const payloadTwo = { query: randomString({ prefix: 'query-two' }) };
      const payloadThree = { query: randomString({ prefix: 'query-three' }) };

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const readUser = source<UserSlug, { query: string }, User, User | null>({
        entity: usersEntity,
        cache: {
          key: cacheKey,
          storage,
          ttl: 'infinity',
          lruMaxEntries: 2,
        },
        run: async ({ payload }) => {
          return {
            id: payload.query,
            name: payload.query,
          };
        },
      });

      const unit = readUser({ slugId });

      await unit.run(payloadOne);
      await Promise.resolve();
      await unit.run(payloadTwo);
      await Promise.resolve();
      await unit.run(payloadThree);
      await Promise.resolve();

      const cacheKeyOne = buildSourceCacheRecordKey({
        scope: { slugId },
        payload: payloadOne,
        mode: 'one',
        sourceCacheKey: cacheKey,
      });
      const cacheKeyTwo = buildSourceCacheRecordKey({
        scope: { slugId },
        payload: payloadTwo,
        mode: 'one',
        sourceCacheKey: cacheKey,
      });
      const cacheKeyThree = buildSourceCacheRecordKey({
        scope: { slugId },
        payload: payloadThree,
        mode: 'one',
        sourceCacheKey: cacheKey,
      });

      expect(storage.getItem(cacheKeyOne)).toBeNull();
      expect(storage.getItem(cacheKeyTwo)).not.toBeNull();
      expect(storage.getItem(cacheKeyThree)).not.toBeNull();
    });

    it('should remove cache record when value leaves entity mode', async () => {
      const slugId = randomNumber();
      const cacheKey = randomString({ prefix: 'cache-key' });
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });
      const storage = createSpyMemoryStorage();

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const readUser = source<UserSlug, User | string, User, User | string | null>({
        entity: usersEntity,
        cache: {
          key: cacheKey,
          storage,
          ttl: 100,
        },
        run: async ({ payload }) => {
          return payload;
        },
      });
      const unit = readUser({ slugId });

      await unit.run({ id: userId, name: userName });
      await Promise.resolve();
      await unit.run(randomString({ prefix: 'non-entity-value' }));
      await Promise.resolve();

      expect(storage.setItemSpy).toHaveBeenCalledTimes(1);
      expect(storage.removeItemSpy).toHaveBeenCalledTimes(1);
    });

    it('should rehydrate value from storage before run when cache ttl is infinity', async () => {
      const slugId = randomNumber();
      const cacheKey = randomString({ prefix: 'cache-key' });
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });
      const user = { id: userId, name: userName };
      const storage = createMemoryStorage();
      const runMock = vi.fn(async () => {
        return user;
      });

      seedSourceCache({
        storage,
        scope: { slugId },
        mode: 'one',
        entities: [user],
        writtenAt: Date.now(),
        sourceCacheKey: cacheKey,
      });

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
      expect(runMock).toHaveBeenCalledTimes(0);
    });

    it('should hydrate by scope and payload before background sync run', async () => {
      const slugId = randomNumber();
      const cacheKey = randomString({ prefix: 'cache-key' });
      const payload = {
        query: randomString({ prefix: 'query' }),
      };
      const cachedUser = {
        id: randomString({ prefix: 'cached-user-id' }),
        name: randomString({ prefix: 'cached-user-name' }),
      };
      const freshUser = {
        id: cachedUser.id,
        name: randomString({ prefix: 'fresh-user-name' }),
      };
      const storage = createMemoryStorage();
      const runMock = vi.fn(async () => {
        return freshUser;
      });

      seedSourceCache({
        storage,
        scope: { slugId },
        payload,
        mode: 'one',
        entities: [cachedUser],
        writtenAt: Date.now(),
        sourceCacheKey: cacheKey,
      });

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const readUser = source<UserSlug, { query: string }, User, User | null>({
        entity: usersEntity,
        cache: {
          key: cacheKey,
          storage,
          ttl: 'infinity',
        },
        run: runMock,
      });

      const unit = readUser({ slugId });
      const statuses: UnitStatus[] = [];
      unit.effect((snapshot) => {
        statuses.push(snapshot.status);
      });

      const runPromise = unit.run(payload);

      expect(unit.get()).toEqual(cachedUser);
      await runPromise;

      expect(runMock).toHaveBeenCalledTimes(1);
      expect(unit.get()).toEqual(freshUser);
      expect(statuses).toContain('rehydrated');
      expect(statuses).toContain('refreshing');
      expect(statuses).toContain('success');
      expect(statuses).not.toContain('loading');
    });

    it('should rehydrate structured entity values from cache without losing their types', async () => {
      const slugId = randomNumber();
      const cacheKey = randomString({ prefix: 'cache-key' });
      const storage = createMemoryStorage();
      const value: StructuredUser = {
        id: randomString({ prefix: 'user-id' }),
        name: randomString({ prefix: 'user-name' }),
        profile: {
          createdAt: new Date('2026-03-22T12:34:56.000Z'),
          total: 123n,
          notANumber: Number.NaN,
          tags: new Set(['sync', 'cache']),
          lookup: new Map([
            ['alpha', 1],
            ['beta', 2],
          ]),
          matcher: /livon/gi,
          optional: undefined,
        },
      };

      seedSourceCache({
        storage,
        scope: { slugId },
        mode: 'one',
        entities: [value],
        writtenAt: Date.now(),
        sourceCacheKey: cacheKey,
      });

      const secondEntity = entity<StructuredUser>({
        idOf: (entry) => entry.id,
      });
      const secondReadValue = source<UserSlug, undefined, StructuredUser, StructuredUser | null, StructuredUser>({
        entity: secondEntity,
        cache: {
          key: cacheKey,
          storage,
          ttl: 'infinity',
        },
        run: async () => undefined,
      });

      const cachedValue = secondReadValue({ slugId }).get();

      expect(cachedValue).not.toBeNull();
      expect(cachedValue?.id).toBe(value.id);
      expect(cachedValue?.name).toBe(value.name);
      expect(cachedValue?.profile.createdAt).toBeInstanceOf(Date);
      expect(cachedValue?.profile.createdAt.toISOString()).toBe('2026-03-22T12:34:56.000Z');
      expect(cachedValue?.profile.total).toBe(123n);
      expect(Number.isNaN(cachedValue?.profile.notANumber ?? 0)).toBe(true);
      expect(cachedValue?.profile.tags).toBeInstanceOf(Set);
      expect(Array.from(cachedValue?.profile.tags.values() ?? [])).toEqual(['sync', 'cache']);
      expect(cachedValue?.profile.lookup).toBeInstanceOf(Map);
      expect(Array.from(cachedValue?.profile.lookup.entries() ?? [])).toEqual([
        ['alpha', 1],
        ['beta', 2],
      ]);
      expect(cachedValue?.profile.matcher).toBeInstanceOf(RegExp);
      expect(cachedValue?.profile.matcher.source).toBe('livon');
      expect(cachedValue?.profile.matcher.flags).toBe('gi');
      expect(cachedValue?.profile.optional).toBeUndefined();
    });

    it('should skip loading status on first run after rehydrate', async () => {
      const slugId = randomNumber();
      const cacheKey = randomString({ prefix: 'cache-key' });
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });
      const user = { id: userId, name: userName };
      const storage = createMemoryStorage();
      const runMock = vi.fn(async () => {
        return user;
      });

      seedSourceCache({
        storage,
        scope: { slugId },
        mode: 'one',
        entities: [user],
        writtenAt: Date.now(),
        sourceCacheKey: cacheKey,
      });

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
      expect(statuses).toContain('refreshing');
      expect(runMock).toHaveBeenCalledTimes(1);
    });

    it('should ignore stale cache when ttl is exceeded', async () => {
      const slugId = randomNumber();
      const cacheKey = randomString({ prefix: 'cache-key' });
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });
      const user = { id: userId, name: userName };
      const storage = createMemoryStorage();
      const runMock = vi.fn(async () => {
        return user;
      });

      seedSourceCache({
        storage,
        scope: { slugId },
        mode: 'one',
        entities: [user],
        writtenAt: Date.now(),
        sourceCacheKey: cacheKey,
      });
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
      expect(runMock).toHaveBeenCalledTimes(0);
    });

    it('should remove stale cache record asynchronously as fire and forget', async () => {
      const slugId = randomNumber();
      const cacheKey = randomString({ prefix: 'cache-key' });
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });
      const user = { id: userId, name: userName };
      const storage = createSpyMemoryStorage();
      const runMock = vi.fn(async () => {
        return user;
      });

      seedSourceCache({
        storage,
        scope: { slugId },
        mode: 'one',
        entities: [user],
        writtenAt: Date.now(),
        sourceCacheKey: cacheKey,
      });
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
      expect(storage.removeItemSpy).toHaveBeenCalledTimes(0);

      await Promise.resolve();

      expect(storage.removeItemSpy).toHaveBeenCalledTimes(1);
      expect(runMock).toHaveBeenCalledTimes(0);
    });

    it('should fallback to entity cache ttl when source cache ttl is omitted', async () => {
      const slugId = randomNumber();
      const cacheKey = randomString({ prefix: 'cache-key' });
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });
      const user = { id: userId, name: userName };
      const storage = createMemoryStorage();
      const runMock = vi.fn(async () => {
        return user;
      });

      seedSourceCache({
        storage,
        scope: { slugId },
        mode: 'one',
        entities: [user],
        writtenAt: Date.now(),
        entityCacheKey: cacheKey,
      });
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
      expect(runMock).toHaveBeenCalledTimes(0);
    });

    it('should use source cache ttl over entity cache ttl when both are provided', async () => {
      const slugId = randomNumber();
      const cacheKey = randomString({ prefix: 'cache-key' });
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });
      const user = { id: userId, name: userName };
      const storage = createMemoryStorage();
      const runMock = vi.fn(async () => {
        return user;
      });

      seedSourceCache({
        storage,
        scope: { slugId },
        mode: 'one',
        entities: [user],
        writtenAt: Date.now(),
        entityCacheKey: cacheKey,
      });
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
      expect(runMock).toHaveBeenCalledTimes(0);
    });
  });
});
