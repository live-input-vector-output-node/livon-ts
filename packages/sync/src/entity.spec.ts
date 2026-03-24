import { describe, expect, it } from 'vitest';

import { entity } from './entity.js';
import { randomString } from './testing/randomData.js';

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

    it('should remove a record when removeOne is called with one id', () => {
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      usersEntity.upsertOne({ id: userId, name: userName });
      usersEntity.removeOne(userId);

      expect(usersEntity.getById(userId)).toBeUndefined();
    });

    it('should remove multiple records when removeMany is called with many ids', () => {
      const firstUserId = randomString({ prefix: 'first-user-id' });
      const secondUserId = randomString({ prefix: 'second-user-id' });
      const firstUserName = randomString({ prefix: 'first-user-name' });
      const secondUserName = randomString({ prefix: 'second-user-name' });

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      usersEntity.upsertOne({ id: firstUserId, name: firstUserName });
      usersEntity.upsertOne({ id: secondUserId, name: secondUserName });
      usersEntity.removeMany([firstUserId, secondUserId]);

      expect(usersEntity.getById(firstUserId)).toBeUndefined();
      expect(usersEntity.getById(secondUserId)).toBeUndefined();
    });
  });
});
