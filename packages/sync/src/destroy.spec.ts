import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entity, type Entity } from './entity.js';
import { source, type Source } from './source.js';
import { randomString } from './testing/randomData.js';

interface User {
  id: string;
  name: string;
}

interface TemplateSlug {
  templateId: string;
}

interface SearchPayload {
  search: string;
}

type UsersResult = readonly User[];
type UsersEntity = Entity<User>;
type ReadUsersSource = Source<TemplateSlug, SearchPayload, UsersResult, UsersResult>;

describe('destroy lifecycle', () => {
  let usersEntity: UsersEntity;
  let onDestroyMock = vi.fn();
  let readUsers: ReadUsersSource;
  let templateId: string;
  let searchValue: string;

  beforeEach(() => {
    templateId = randomString({ prefix: 'template-id' });
    searchValue = randomString({ prefix: 'search' });
    onDestroyMock = vi.fn();

    usersEntity = entity<User>({
      idOf: (value) => value.id,
      ttl: 30_000,
    });

    readUsers = source<TemplateSlug, SearchPayload, User, UsersResult, UsersResult>({
      entity: usersEntity,
      onDestroy: onDestroyMock,
      run: async ({ payload }) => {
        return [{ id: payload.search, name: payload.search }];
      },
    });
  });

  describe('happy', () => {
    it('should call configured onDestroy when source unit is destroyed', () => {
      const usersStore = readUsers({ templateId });

      usersStore.destroy();

      expect(onDestroyMock).toHaveBeenCalledTimes(1);
    });

    it('should pass scope and payload into onDestroy callback', async () => {
      const usersStore = readUsers({ templateId });

      await usersStore.run({ search: searchValue });

      usersStore.destroy();

      expect(onDestroyMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          scope: { templateId },
          payload: { search: searchValue },
        }),
      );
    });

    it('should call onDestroy at most once for repeated destroy calls', () => {
      const usersStore = readUsers({ templateId });

      usersStore.destroy();
      usersStore.destroy();

      expect(onDestroyMock).toHaveBeenCalledTimes(1);
    });

    it('should detach effect listeners after destroy', async () => {
      const usersStore = readUsers({ templateId });
      const listener = vi.fn();

      usersStore.effect(listener);
      usersStore.destroy();
      await usersStore.run({ search: searchValue });

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
