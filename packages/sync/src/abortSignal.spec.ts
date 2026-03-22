import { describe, expect, it, vi } from 'vitest';

import { action } from './action.js';
import { entity } from './entity.js';
import { source } from './source.js';
import { stream } from './stream.js';
import { randomString } from './testing/randomData.js';

interface User {
  id: string;
  name: string;
}

interface TemplateSlug {
  templateId: string;
}

interface CreateUserPayload {
  name: string;
}

interface Release {
  (): void;
}

describe('cleanup lifecycle', () => {
  describe('happy', () => {
    it('should call source cleanup when source unit is destroyed', async () => {
      const templateId = randomString({ prefix: 'template-id' });
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const cleanup = vi.fn();
      let release: Release | undefined;

      const readUsers = source<TemplateSlug, undefined, User, readonly User[]>({
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
      const usersStore = readUsers({ templateId });

      const runPromise = usersStore.run();
      usersStore.destroy();
      release?.();
      await runPromise;

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should call source cleanup when source unit is stopped', async () => {
      const templateId = randomString({ prefix: 'template-id' });
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const cleanup = vi.fn();
      let release: Release | undefined;

      const readUsers = source<TemplateSlug, undefined, User, readonly User[]>({
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
      const usersStore = readUsers({ templateId });

      const runPromise = usersStore.run();
      usersStore.stop();
      release?.();
      await runPromise;

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should call action cleanup when action unit is destroyed', async () => {
      const templateId = randomString({ prefix: 'template-id' });
      const createName = randomString({ prefix: 'create-name' });
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const cleanup = vi.fn();
      let release: Release | undefined;

      const createUser = action<TemplateSlug, CreateUserPayload, User, User>({
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
      const createUserStore = createUser({ templateId });

      const runPromise = createUserStore.run({ name: createName });
      createUserStore.destroy();
      release?.();
      await runPromise;

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should call action cleanup when action unit is stopped', async () => {
      const templateId = randomString({ prefix: 'template-id' });
      const createName = randomString({ prefix: 'create-name' });
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const cleanup = vi.fn();
      let release: Release | undefined;

      const createUser = action<TemplateSlug, CreateUserPayload, User, User>({
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
      const createUserStore = createUser({ templateId });

      const runPromise = createUserStore.run({ name: createName });
      createUserStore.stop();
      release?.();
      await runPromise;

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should call stream cleanup callback when stream unit is stopped', async () => {
      const templateId = randomString({ prefix: 'template-id' });
      const usersEntity = entity<User>({
        idOf: (value) => value.id,
      });
      const cleanup = vi.fn();

      const onUserUpdated = stream<TemplateSlug, User, User, User | null>({
        entity: usersEntity,
        run: async () => {
          return () => {
            cleanup();
          };
        },
      });
      const streamStore = onUserUpdated({ templateId });

      streamStore.start({
        id: randomString({ prefix: 'stream-user-id' }),
        name: randomString({ prefix: 'stream-user-name' }),
      });
      await Promise.resolve();
      streamStore.stop();
      await Promise.resolve();

      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });
});
