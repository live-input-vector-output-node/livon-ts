import { describe, expect, it } from 'vitest';

import { entity } from './entity.js';
import { source } from './source.js';
import { randomString } from './testing/randomData.js';

interface User {
  id: string;
  name: string;
}

interface TemplateSlug {
  templateId: string;
}

interface MessageMeta {
  severity: string;
  text: string;
}

type UnitStatus = 'idle' | 'loading' | 'success' | 'error';

describe('status and meta transitions', () => {
  describe('happy', () => {
    it('should emit loading status while source run is in progress', async () => {
      const templateId = randomString({ prefix: 'template-id' });
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      const readUsers = source<TemplateSlug, undefined, User, readonly User[]>({
        entity: usersEntity,
        run: async ({ upsertMany }) => {
          await Promise.resolve();
          upsertMany([{ id: userId, name: userName }]);
        },
      });

      const usersStore = readUsers({ templateId });
      const statuses: UnitStatus[] = [];

      usersStore.effect((snapshot) => {
        statuses.push(snapshot.status);
      });

      await usersStore.run();

      expect(statuses).toContain('loading');
    });

    it('should emit success status when source run resolves', async () => {
      const templateId = randomString({ prefix: 'template-id' });
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });
      const infoText = randomString({ prefix: 'meta-text' });

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      const readUsers = source<TemplateSlug, undefined, User, readonly User[]>({
        entity: usersEntity,
        run: async ({ setMeta, upsertMany }) => {
          setMeta({ severity: 'info', text: infoText });
          upsertMany([{ id: userId, name: userName }]);
        },
      });

      const usersStore = readUsers({ templateId });
      const statuses: UnitStatus[] = [];

      usersStore.effect((snapshot) => {
        statuses.push(snapshot.status);
      });

      await usersStore.run();

      expect(statuses).toContain('success');
    });

    it('should emit error status when source run rejects', async () => {
      const templateId = randomString({ prefix: 'template-id' });
      const errorMessage = randomString({ prefix: 'error-message' });

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      const readUsers = source<TemplateSlug, undefined, User, readonly User[]>({
        entity: usersEntity,
        run: async () => {
          throw new Error(errorMessage);
        },
      });

      const usersStore = readUsers({ templateId });
      const statuses: UnitStatus[] = [];

      usersStore.effect((snapshot) => {
        statuses.push(snapshot.status);
      });

      await expect(usersStore.run()).rejects.toThrow(errorMessage);

      expect(statuses).toContain('error');
    });

    it('should expose latest meta payload to effect listeners', async () => {
      const templateId = randomString({ prefix: 'template-id' });
      const userId = randomString({ prefix: 'user-id' });
      const userName = randomString({ prefix: 'user-name' });
      const warningText = randomString({ prefix: 'warning-text' });
      const warningMeta: MessageMeta = {
        severity: 'warning',
        text: warningText,
      };

      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });

      const readUsers = source<TemplateSlug, undefined, User, readonly User[]>({
        entity: usersEntity,
        run: async ({ setMeta, upsertMany }) => {
          setMeta(warningMeta);
          upsertMany([{ id: userId, name: userName }]);
        },
      });

      const usersStore = readUsers({ templateId });
      const metas: unknown[] = [];

      usersStore.effect((snapshot) => {
        metas.push(snapshot.meta);
      });

      await usersStore.run();

      expect(metas).toContainEqual(warningMeta);
    });
  });
});
