import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entity, type Entity } from './entity.js';
import { source, type SourceRunContext } from './source/index.js';
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
type ReadUsersRunContext = SourceRunContext<TemplateSlug, SearchPayload, UsersResult>;

const createReadUsersSource = (
  usersEntity: UsersEntity,
  run: (context: ReadUsersRunContext) => Promise<void> | void,
) => {
  return source({
    entity: usersEntity,
    mode: 'many',
  })<TemplateSlug, SearchPayload>({
    key: 'read-users',
    defaultValue: [],
    run,
  });
};

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
  let readUsers: ReturnType<typeof createReadUsersSource>;
  let templateId: string;
  let searchValue: string;

  beforeEach(() => {
    templateId = randomString({ prefix: 'template-id' });
    searchValue = randomString({ prefix: 'search' });

    runMock = vi.fn(async ({ payload, set }) => {
      set([{ id: payload.search, name: payload.search }]);
    });

    usersEntity = entity<User>({
      key: 'memoization-spec',
      idOf: (value) => value.id,
      ttl: 30_000,
    });

    readUsers = createReadUsersSource(usersEntity, runMock);
  });

  describe('happy', () => {
    it('should return same source unit for equal identity values', () => {
      const first = readUsers({ templateId });
      const second = readUsers({ templateId });

      expect(second).toBe(first);
    });

    it('should return same source unit for equal identity values with new object references', () => {
      const first = readUsers({ templateId });
      const secondTemplateId = templateId.split('').join('');
      const second = readUsers({ templateId: secondTemplateId });

      expect(second).toBe(first);
    });

    it('should keep same source unit for different payload values on snapshot.load()', async () => {
      const differentSearchValue = randomString({ prefix: 'different-search' });
      const unit = readUsers({ templateId });

      await unit.getSnapshot().load({ search: searchValue });
      await unit.getSnapshot().load({ search: differentSearchValue });

      expect(readUsers({ templateId })).toBe(unit);
    });

    it('should dedupe in-flight run calls for same serialized identity and payload', async () => {
      const blocker = deferred<UsersResult>();

      runMock = vi.fn(async ({ upsertMany }) => {
        const users = await blocker.promise;
        upsertMany(users);
      });

      readUsers = createReadUsersSource(usersEntity, runMock);

      const fromFirstComponent = readUsers({ templateId });
      const fromSecondComponent = readUsers({ templateId });

      const firstRun = fromFirstComponent.getSnapshot().load({ search: searchValue });
      const secondRun = fromSecondComponent.getSnapshot().load({ search: searchValue });

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
