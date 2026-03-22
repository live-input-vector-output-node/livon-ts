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

interface Deferred<TValue> {
  promise: Promise<TValue>;
  resolve: (value: TValue) => void;
}

type UsersResult = readonly User[];
type UsersEntity = Entity<User>;
type ReadUsersSource = Source<TemplateSlug, SearchPayload, UsersResult, UsersResult>;

const deferred = <TValue>(): Deferred<TValue> => {
  let resolve: (value: TValue) => void = () => undefined;
  const promise = new Promise<TValue>((done) => {
    resolve = done;
  });

  return {
    promise,
    resolve,
  };
};

describe('source memoization', () => {
  let runMock = vi.fn();
  let usersEntity: UsersEntity;
  let readUsers: ReadUsersSource;
  let templateId: string;
  let searchValue: string;

  beforeEach(() => {
    templateId = randomString({ prefix: 'template-id' });
    searchValue = randomString({ prefix: 'search' });

    runMock = vi.fn(async ({ payload, entity }) => {
      entity.upsertMany([{ id: payload.search, name: payload.search }]);
    });

    usersEntity = entity<User>({
      idOf: (value) => value.id,
      ttl: 30_000,
    });

    readUsers = source<TemplateSlug, SearchPayload, User, UsersResult, UsersResult>({
      entity: usersEntity,
      run: runMock,
    });
  });

  describe('happy', () => {
    it('should return same source unit for equal scope values', () => {
      const first = readUsers({ templateId });
      const second = readUsers({ templateId });

      expect(second).toBe(first);
    });

    it('should return same source unit for equal scope values with new object references', () => {
      const first = readUsers({ templateId });
      const secondTemplateId = templateId.split('').join('');
      const second = readUsers({ templateId: secondTemplateId });

      expect(second).toBe(first);
    });

    it('should keep same source unit for different payload values on run()', async () => {
      const differentSearchValue = randomString({ prefix: 'different-search' });
      const unit = readUsers({ templateId });

      await unit.run({ search: searchValue });
      await unit.run({ search: differentSearchValue });

      expect(readUsers({ templateId })).toBe(unit);
    });

    it('should dedupe in-flight run calls for same serialized scope and payload', async () => {
      const blocker = deferred<UsersResult>();

      runMock = vi.fn(async ({ entity }) => {
        const users = await blocker.promise;
        entity.upsertOne(users);
      });

      readUsers = source<TemplateSlug, SearchPayload, User, UsersResult, UsersResult>({
        entity: usersEntity,
        run: runMock,
      });

      const fromFirstComponent = readUsers({ templateId });
      const fromSecondComponent = readUsers({ templateId });

      const firstRun = fromFirstComponent.run({ search: searchValue });
      const secondRun = fromSecondComponent.run({ search: searchValue });

      expect(runMock).toHaveBeenCalledTimes(1);

      blocker.resolve([
        {
          id: randomString({ prefix: 'resolved-id' }),
          name: randomString({ prefix: 'resolved-name' }),
        },
      ]);
      await Promise.all([firstRun, secondRun]);
    });
  });
});
