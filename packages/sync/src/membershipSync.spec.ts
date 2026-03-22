import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entity, type Entity } from './entity.js';
import { source, type Source } from './source.js';
import { randomString } from './testing/randomData.js';

interface User {
  id: string;
  name: string;
  templateId: string;
}

interface UserByIdSlug {
  id: string;
}

interface UsersByTemplateSlug {
  templateId: string;
}

type UsersEntity = Entity<User>;
type ReadUserSource = Source<UserByIdSlug, undefined, User | null, User>;
type ReadUsersSource = Source<UsersByTemplateSlug, undefined, readonly User[], readonly User[]>;

describe('entity membership sync across sources', () => {
  let usersEntity: UsersEntity;
  let readUserApi = vi.fn();
  let readUsersApi = vi.fn();
  let readUser: ReadUserSource;
  let readUsers: ReadUsersSource;
  let firstUserId: string;
  let secondUserId: string;
  let firstTemplateId: string;
  let secondTemplateId: string;
  let firstBaseName: string;
  let secondBaseName: string;
  let firstUpdatedName: string;
  let secondUpdatedName: string;

  beforeEach(() => {
    firstUserId = randomString({ prefix: 'user-id' });
    secondUserId = randomString({ prefix: 'user-id' });
    firstTemplateId = randomString({ prefix: 'template-id' });
    secondTemplateId = randomString({ prefix: 'template-id' });
    firstBaseName = randomString({ prefix: 'base-name' });
    secondBaseName = randomString({ prefix: 'base-name' });
    firstUpdatedName = randomString({ prefix: 'updated-name' });
    secondUpdatedName = randomString({ prefix: 'updated-name' });

    readUserApi = vi.fn(async ({ id }) => {
      if (id === firstUserId) {
        return { id: firstUserId, name: firstUpdatedName, templateId: firstTemplateId };
      }

      return { id: secondUserId, name: secondUpdatedName, templateId: secondTemplateId };
    });

    readUsersApi = vi.fn(async ({ templateId }) => {
      if (templateId === firstTemplateId) {
        return [{ id: firstUserId, name: firstBaseName, templateId: firstTemplateId }];
      }

      return [{ id: secondUserId, name: secondBaseName, templateId: secondTemplateId }];
    });

    usersEntity = entity<User>({
      idOf: (value) => value.id,
      ttl: 30_000,
    });

    readUser = source<UserByIdSlug, undefined, User, User | null, User>({
      entity: usersEntity,
      run: async ({ scope, entity }) => {
        const user = await readUserApi(scope);
        entity.upsertOne(user);
      },
    });

    readUsers = source<UsersByTemplateSlug, undefined, User, readonly User[], readonly User[]>({
      entity: usersEntity,
      run: async ({ scope, entity }) => {
        const users = await readUsersApi(scope);
        entity.upsertMany(users);
      },
    });
  });

  describe('happy', () => {
    it('should sync one-query updates into existing many-query data for same entity id', async () => {
      const manyStore = readUsers({ templateId: firstTemplateId });
      const oneStore = readUser({ id: firstUserId });

      await manyStore.run();
      await oneStore.run();

      expect(manyStore.get()).toEqual([
        { id: firstUserId, name: firstUpdatedName, templateId: firstTemplateId },
      ]);
    });

    it('should sync many-query updates into existing one-query data for same entity id', async () => {
      const oneStore = readUser({ id: firstUserId });
      const manyStore = readUsers({ templateId: firstTemplateId });

      await oneStore.run();
      await manyStore.run();

      expect(oneStore.get()).toEqual({
        id: firstUserId,
        name: firstBaseName,
        templateId: firstTemplateId,
      });
    });

    it('should notify many-query listeners when one-query updates the same entity id', async () => {
      const manyStore = readUsers({ templateId: firstTemplateId });
      const oneStore = readUser({ id: firstUserId });
      const manyListener = vi.fn();

      manyStore.effect(manyListener);
      await manyStore.run();
      manyListener.mockClear();
      await oneStore.run();

      expect(manyListener).toHaveBeenCalledTimes(1);
    });

    it('should notify one-query listeners when many-query updates the same entity id', async () => {
      const oneStore = readUser({ id: firstUserId });
      const manyStore = readUsers({ templateId: firstTemplateId });
      const oneListener = vi.fn();

      oneStore.effect(oneListener);
      await oneStore.run();
      oneListener.mockClear();
      await manyStore.run();

      expect(oneListener).toHaveBeenCalledTimes(1);
      expect(oneStore.get()).toEqual({
        id: firstUserId,
        name: firstBaseName,
        templateId: firstTemplateId,
      });
    });

    it('should batch one-query notifications when many-query writes the same id multiple times in one run', async () => {
      const duplicateFirstName = randomString({ prefix: 'duplicate-name' });
      const duplicateSecondName = randomString({ prefix: 'duplicate-name' });
      readUsersApi = vi.fn(async () => {
        return [
          { id: firstUserId, name: duplicateFirstName, templateId: firstTemplateId },
          { id: firstUserId, name: duplicateSecondName, templateId: firstTemplateId },
        ];
      });

      const oneStore = readUser({ id: firstUserId });
      const manyStore = readUsers({ templateId: firstTemplateId });
      const oneListener = vi.fn();

      oneStore.effect(oneListener);
      await oneStore.run();
      oneListener.mockClear();
      await manyStore.run();

      expect(oneListener).toHaveBeenCalledTimes(1);
      expect(oneStore.get()).toEqual({
        id: firstUserId,
        name: duplicateSecondName,
        templateId: firstTemplateId,
      });
    });

    it('should keep one-query value empty after delete even when many-query writes same id again', async () => {
      const restoredName = randomString({ prefix: 'restored-name' });
      readUsersApi = vi.fn(async () => {
        return [{ id: firstUserId, name: restoredName, templateId: firstTemplateId }];
      });

      const oneStore = readUser({ id: firstUserId });
      const manyStore = readUsers({ templateId: firstTemplateId });
      const oneListener = vi.fn();

      oneStore.effect(oneListener);
      await oneStore.run();
      oneListener.mockClear();
      usersEntity.removeOne(firstUserId);
      expect(oneListener).toHaveBeenCalledTimes(1);
      expect(oneStore.get()).toBeNull();
      oneListener.mockClear();
      await manyStore.run();

      expect(readUserApi).toHaveBeenCalledTimes(1);
      expect(oneListener).not.toHaveBeenCalled();
    });

    it('should notify many-query listeners and remove value when entity removes a relevant id', async () => {
      const manyStore = readUsers({ templateId: firstTemplateId });
      const manyListener = vi.fn();

      manyStore.effect(manyListener);
      await manyStore.run();
      manyListener.mockClear();
      usersEntity.removeOne(firstUserId);

      expect(manyListener).toHaveBeenCalledTimes(1);
      expect(manyStore.get()).toEqual([]);
    });

    it('should not mutate unrelated scope memberships when another entity id updates', async () => {
      const firstTemplateStore = readUsers({ templateId: firstTemplateId });
      const secondTemplateStore = readUsers({ templateId: secondTemplateId });
      const oneStore = readUser({ id: firstUserId });

      await firstTemplateStore.run();
      await secondTemplateStore.run();
      await oneStore.run();

      expect(secondTemplateStore.get()).toEqual([
        { id: secondUserId, name: secondBaseName, templateId: secondTemplateId },
      ]);
    });
  });
});
