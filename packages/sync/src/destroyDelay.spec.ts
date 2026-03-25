import { describe, expect, it } from 'vitest';

import { action } from './action.js';
import { entity } from './entity.js';
import { source } from './source.js';
import { stream } from './stream.js';
import { randomString } from './testing/randomData.js';

interface User {
  id: string;
  name: string;
}

interface UserSlug {
  templateId: string;
}

interface UserPayload {
  id: string;
  name: string;
}

describe('destroyDelay config', () => {
  describe('happy', () => {
    it('should keep configured destroyDelay on entity when entity is created', () => {
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        destroyDelay: 800,
      });

      expect(usersEntity.destroyDelay).toBe(800);
    });

    it('should use source destroyDelay when source overrides entity value', () => {
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        destroyDelay: 800,
      });

      const readUser = source<UserSlug, undefined, User | null>({
        entity: usersEntity,
        destroyDelay: 400,
        run: async () => undefined,
      });

      const unit = readUser({ templateId: randomString({ prefix: 'template-id' }) });

      expect(unit.destroyDelay).toBe(400);
    });

    it('should use entity destroyDelay when source does not override it', () => {
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
        destroyDelay: 800,
      });

      const readUser = source<UserSlug, undefined, User | null>({
        entity: usersEntity,
        run: async () => undefined,
      });

      const unit = readUser({ templateId: randomString({ prefix: 'template-id' }) });

      expect(unit.destroyDelay).toBe(800);
    });

    it('should use default destroyDelay when neither source nor entity config is set', () => {
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      const readUser = source<UserSlug, undefined, User | null>({
        entity: usersEntity,
        run: async () => undefined,
      });

      const unit = readUser({ templateId: randomString({ prefix: 'template-id' }) });

      expect(unit.destroyDelay).toBe(250);
    });

    it('should expose destroyDelay on action units when action is configured', () => {
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      const createUser = action<UserSlug, UserPayload, User | null>({
        entity: usersEntity,
        destroyDelay: 300,
        run: async ({ payload }) => {
          return payload;
        },
      });

      const unit = createUser({ templateId: randomString({ prefix: 'template-id' }) });

      expect(unit.destroyDelay).toBe(300);
    });

    it('should expose destroyDelay on stream units when stream is configured', () => {
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      const onUserUpdated = stream<UserSlug, UserPayload, User | null>({
        entity: usersEntity,
        destroyDelay: 500,
        run: async ({ payload }) => {
          return payload;
        },
      });

      const unit = onUserUpdated({ templateId: randomString({ prefix: 'template-id' }) });

      expect(unit.destroyDelay).toBe(500);
    });
  });
});
