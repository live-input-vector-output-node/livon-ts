import { describe, expect, it, vi } from 'vitest';

import { entity } from './entity.js';
import { defaultRuntimeQueue } from './runtimeQueue/index.js';
import { randomString } from './testing/randomData.js';
import {
  resolveAdaptiveReadWriteByCache,
} from './utils/adaptiveReadWrite.js';

interface Project {
  id: string;
  name: string;
  templateId: string;
}

interface User {
  id: string;
  name?: string;
  status?: string;
}

describe('entity()', () => {
  describe('happy', () => {
    it('should be available when entity module is imported', () => {
      expect(typeof entity).toBe('function');
    });

    it('should allow explicit generic type on entity function', () => {
      const projectEntity = entity<Project>({
        idOf: (value) => value.id,
        ttl: 30_000,
      });

      expect(projectEntity.ttl).toBe(30_000);
    });

    it('should keep configured ttl when entity is created', () => {
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        ttl: 30_000,
      });

      expect(usersEntity.ttl).toBe(30_000);
    });

    it('should expose default readWrite strategy when not configured', () => {
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      expect(usersEntity.readWrite).toEqual({
        batch: true,
        subview: true,
      });
    });

    it('should keep configured readWrite strategy when entity is created', () => {
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        readWrite: {
          batch: false,
          subview: false,
        },
      });

      expect(usersEntity.readWrite).toEqual({
        batch: false,
        subview: false,
      });
    });

    it('should resolve adaptive readWrite strategy when adaptive mode is enabled', () => {
      const expected = resolveAdaptiveReadWriteByCache({
        cacheEnabled: true,
        lruEnabled: true,
        operation: 'readMany',
        fallback: {
          batch: true,
          subview: true,
        },
      });
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        cache: {
          key: 'adaptive-cache',
          ttl: 'infinity',
          lruMaxEntries: 256,
          storage: {
            getItem: () => null,
            setItem: () => {
              return;
            },
            removeItem: () => {
              return;
            },
          },
        },
        readWrite: {
          adaptive: true,
        },
      });

      expect(usersEntity.readWrite).toEqual(expected);
    });

    it('should keep explicit readWrite flags over adaptive recommendations', () => {
      const expected = resolveAdaptiveReadWriteByCache({
        cacheEnabled: true,
        lruEnabled: true,
        operation: 'readMany',
        fallback: {
          batch: true,
          subview: true,
        },
      });
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        cache: {
          key: 'adaptive-cache',
          ttl: 'infinity',
          lruMaxEntries: 256,
          storage: {
            getItem: () => null,
            setItem: () => {
              return;
            },
            removeItem: () => {
              return;
            },
          },
        },
        readWrite: {
          adaptive: true,
          batch: false,
        },
      });

      expect(usersEntity.readWrite).toEqual({
        batch: false,
        subview: expected.subview,
      });
    });

    it('should resolve adaptive strategy from matrix when adaptive is enabled', () => {
      const expected = resolveAdaptiveReadWriteByCache({
        cacheEnabled: false,
        lruEnabled: false,
        operation: 'readMany',
        fallback: {
          batch: true,
          subview: true,
        },
      });
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        readWrite: {
          adaptive: true,
        },
      });

      expect(usersEntity.readWrite).toEqual(expected);
    });

    it('should expose a shared map when entity is created', () => {
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      expect(usersEntity.entitiesById).toBeInstanceOf(Map);
    });

    it('should store a record when upsertOne is called with one record', () => {
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      usersEntity.upsertOne({ id: userId, name: userName });

      expect(usersEntity.getById(userId)).toEqual({ id: userId, name: userName });
    });

    it('should merge existing record when upsertOne is called with merge true', () => {
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });
      const userStatus = randomString({ prefix: 'user-status' });

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      usersEntity.upsertOne({ id: userId, name: userName });
      usersEntity.upsertOne({ id: userId, status: userStatus }, { merge: true });

      expect(usersEntity.getById(userId)).toEqual({
        id: userId,
        name: userName,
        status: userStatus,
      });
    });

    it('should keep current instance on replace upsert when next object is shallow-equivalent', () => {
      const userId = randomString({ prefix: 'user-id' });
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });
      let notifyCount = 0;

      usersEntity.registerUnit({
        key: 'users-unit',
        onChange: () => {
          notifyCount += 1;
        },
      });
      usersEntity.setUnitMembership({
        key: 'users-unit',
        ids: [userId],
      });

      const first = usersEntity.upsertOne({
        id: userId,
        name: 'Ada',
      });
      const second = usersEntity.upsertOne({
        id: userId,
        name: 'Ada',
      });

      expect(second).toBe(first);
      expect(usersEntity.getById(userId)).toBe(first);
      expect(notifyCount).toBe(1);
    });

    it('should keep current instance on merge upsert when merged shape is unchanged', () => {
      const userId = randomString({ prefix: 'user-id' });
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });
      let notifyCount = 0;

      usersEntity.registerUnit({
        key: 'users-merge-unit',
        onChange: () => {
          notifyCount += 1;
        },
      });
      usersEntity.setUnitMembership({
        key: 'users-merge-unit',
        ids: [userId],
      });

      const first = usersEntity.upsertOne({
        id: userId,
        name: 'Grace',
        status: 'active',
      });
      const second = usersEntity.upsertOne({
        id: userId,
        name: 'Grace',
      }, { merge: true });
      const third = usersEntity.upsertOne({
        id: userId,
        status: 'active',
      }, { merge: true });

      expect(second).toBe(first);
      expect(third).toBe(first);
      expect(usersEntity.getById(userId)).toBe(first);
      expect(notifyCount).toBe(1);
    });

    it('should remove a record when deleteOne is called with one id', () => {
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      usersEntity.upsertOne({ id: userId, name: userName });
      usersEntity.deleteOne(userId);

      expect(usersEntity.getById(userId)).toBeUndefined();
    });

    it('should remove multiple records when deleteMany is called with many ids', () => {
      const firstUserId = randomString({ prefix: 'first-user-id' });
      const secondUserId = randomString({ prefix: 'second-user-id' });
      const firstUserName = randomString({ prefix: 'first-user-name' });
      const secondUserName = randomString({ prefix: 'second-user-name' });

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      usersEntity.upsertOne({ id: firstUserId, name: firstUserName });
      usersEntity.upsertOne({ id: secondUserId, name: secondUserName });
      usersEntity.deleteMany([firstUserId, secondUserId]);

      expect(usersEntity.getById(firstUserId)).toBeUndefined();
      expect(usersEntity.getById(secondUserId)).toBeUndefined();
    });

    it('should immediately remove orphaned entities when no ttl is configured', () => {
      const userId = randomString({ prefix: 'user-id' });
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      usersEntity.registerUnit({
        key: 'orphan-unit',
        onChange: () => {
          return;
        },
      });
      usersEntity.setUnitMembership({
        key: 'orphan-unit',
        ids: [userId],
      });

      usersEntity.upsertOne({ id: userId, name: 'Ada' });
      expect(usersEntity.getById(userId)).toEqual({ id: userId, name: 'Ada' });

      usersEntity.setUnitMembership({
        key: 'orphan-unit',
        ids: [],
      });

      expect(usersEntity.getById(userId)).toBeUndefined();
    });

    it('should keep entities while at least one unit still references the same id', () => {
      const userId = randomString({ prefix: 'shared-user-id' });
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      usersEntity.registerUnit({
        key: 'first-unit',
        onChange: () => {
          return;
        },
      });
      usersEntity.registerUnit({
        key: 'second-unit',
        onChange: () => {
          return;
        },
      });
      usersEntity.setUnitMembership({
        key: 'first-unit',
        ids: [userId],
      });
      usersEntity.setUnitMembership({
        key: 'second-unit',
        ids: [userId],
      });
      usersEntity.upsertOne({ id: userId, name: 'Grace' });

      usersEntity.setUnitMembership({
        key: 'first-unit',
        ids: [],
      });
      expect(usersEntity.getById(userId)).toEqual({ id: userId, name: 'Grace' });

      usersEntity.setUnitMembership({
        key: 'second-unit',
        ids: [],
      });
      expect(usersEntity.getById(userId)).toBeUndefined();
    });

    it('should remove orphaned entities only after configured ttl', () => {
      vi.useFakeTimers();

      try {
        const userId = randomString({ prefix: 'ttl-user-id' });
        const usersEntity = entity<User>({
          idOf: (value) => value.id,
          ttl: 100,
        });

        usersEntity.registerUnit({
          key: 'ttl-unit',
          onChange: () => {
            return;
          },
        });
        usersEntity.setUnitMembership({
          key: 'ttl-unit',
          ids: [userId],
        });
        usersEntity.upsertOne({ id: userId, name: 'Linus' });

        usersEntity.setUnitMembership({
          key: 'ttl-unit',
          ids: [],
        });

        vi.advanceTimersByTime(99);
        expect(usersEntity.getById(userId)).toEqual({ id: userId, name: 'Linus' });

        vi.advanceTimersByTime(1);
        expect(usersEntity.getById(userId)).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should keep orphaned entities when cache ttl is infinity', () => {
      const userId = randomString({ prefix: 'infinite-cache-user-id' });
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        cache: {
          ttl: 'infinity',
        },
      });

      usersEntity.registerUnit({
        key: 'cache-unit',
        onChange: () => {
          return;
        },
      });
      usersEntity.setUnitMembership({
        key: 'cache-unit',
        ids: [userId],
      });
      usersEntity.upsertOne({ id: userId, name: 'Taylor' });

      usersEntity.setUnitMembership({
        key: 'cache-unit',
        ids: [],
      });

      expect(usersEntity.getById(userId)).toEqual({ id: userId, name: 'Taylor' });
    });

    it('should batch large upsertMany notifications through microtask queue', () => {
      defaultRuntimeQueue.flush('state');
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const ids = Array.from({ length: 40 }, (_unused, index) => {
        return `user-${index}`;
      });
      let notifyCount = 0;

      usersEntity.registerUnit({
        key: 'batched-upsert-many-unit',
        onChange: () => {
          notifyCount += 1;
        },
      });
      usersEntity.setUnitMembership({
        key: 'batched-upsert-many-unit',
        ids,
      });

      usersEntity.upsertMany(ids.map((id) => {
        return {
          id,
          name: `Name ${id}`,
        };
      }));

      expect(notifyCount).toBe(0);
      defaultRuntimeQueue.flush('state');
      expect(notifyCount).toBe(1);
    });

    it('should batch large deleteMany notifications through microtask queue', () => {
      defaultRuntimeQueue.flush('state');
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const ids = Array.from({ length: 40 }, (_unused, index) => {
        return `remove-user-${index}`;
      });
      let notifyCount = 0;

      usersEntity.upsertMany(ids.map((id) => {
        return {
          id,
          name: `Name ${id}`,
        };
      }));
      defaultRuntimeQueue.flush('state');

      usersEntity.registerUnit({
        key: 'batched-remove-many-unit',
        onChange: () => {
          notifyCount += 1;
        },
      });
      usersEntity.setUnitMembership({
        key: 'batched-remove-many-unit',
        ids,
      });

      usersEntity.deleteMany(ids);

      expect(notifyCount).toBe(0);
      defaultRuntimeQueue.flush('state');
      expect(notifyCount).toBe(1);
    });

    it('should keep large upsertMany notifications synchronous when batch strategy is disabled', () => {
      defaultRuntimeQueue.flush('state');
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        readWrite: {
          batch: false,
        },
      });
      const ids = Array.from({ length: 40 }, (_unused, index) => {
        return `sync-user-${index}`;
      });
      let notifyCount = 0;

      usersEntity.registerUnit({
        key: 'sync-upsert-many-unit',
        onChange: () => {
          notifyCount += 1;
        },
      });
      usersEntity.setUnitMembership({
        key: 'sync-upsert-many-unit',
        ids,
      });

      usersEntity.upsertMany(ids.map((id) => {
        return {
          id,
          name: `Name ${id}`,
        };
      }));

      expect(notifyCount).toBeGreaterThan(0);
      const notifyCountAfterUpsert = notifyCount;
      defaultRuntimeQueue.flush('state');
      expect(notifyCount).toBe(notifyCountAfterUpsert);
    });

    it('should keep large deleteMany notifications synchronous when batch strategy is disabled', () => {
      defaultRuntimeQueue.flush('state');
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        readWrite: {
          batch: false,
        },
      });
      const ids = Array.from({ length: 40 }, (_unused, index) => {
        return `sync-remove-user-${index}`;
      });
      let notifyCount = 0;

      usersEntity.upsertMany(ids.map((id) => {
        return {
          id,
          name: `Name ${id}`,
        };
      }));
      defaultRuntimeQueue.flush('state');

      usersEntity.registerUnit({
        key: 'sync-remove-many-unit',
        onChange: () => {
          notifyCount += 1;
        },
      });
      usersEntity.setUnitMembership({
        key: 'sync-remove-many-unit',
        ids,
      });

      usersEntity.deleteMany(ids);

      expect(notifyCount).toBeGreaterThan(0);
      const notifyCountAfterRemove = notifyCount;
      defaultRuntimeQueue.flush('state');
      expect(notifyCount).toBe(notifyCountAfterRemove);
    });
  });
});
