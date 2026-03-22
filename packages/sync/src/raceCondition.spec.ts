import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entity, type Entity } from './entity.js';
import { source, type Source } from './source.js';
import { randomNumber, randomString } from './testing/randomData.js';

interface User {
  id: string;
  name: string;
}

interface UserSlug {
  slugId: number;
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
type ReadUsersSource = Source<UserSlug, SearchPayload, UsersResult, UsersResult>;

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

describe('source() race handling', () => {
  let searchApi = vi.fn();
  let usersEntity: UsersEntity;
  let readUsers: ReadUsersSource;
  let slow: Deferred<UsersResult>;
  let fast: Deferred<UsersResult>;
  let slugId: number;
  let slowSearch: string;
  let fastSearch: string;

  beforeEach(() => {
    slugId = randomNumber();
    slowSearch = randomString({ prefix: 'slow-search' });
    fastSearch = randomString({ prefix: 'fast-search' });

    slow = deferred<UsersResult>();
    fast = deferred<UsersResult>();

    searchApi = vi.fn(async ({ search }) => {
      if (search === slowSearch) {
        return slow.promise;
      }

      return fast.promise;
    });

    usersEntity = entity<User>({
      idOf: (value) => value.id,
      ttl: 30_000,
    });

    readUsers = source<UserSlug, SearchPayload, User, UsersResult, UsersResult>({
      entity: usersEntity,
      run: async ({ payload, entity }) => {
        const result = await searchApi(payload);
        entity.upsertMany(result);
      },
    });
  });

  describe('happy', () => {
    it('should call search api in request creation order', () => {
      const unit = readUsers({ slugId });

      unit.run({ search: slowSearch });
      unit.run({ search: fastSearch });

      expect(searchApi).toHaveBeenNthCalledWith(1, { search: slowSearch });
      expect(searchApi).toHaveBeenNthCalledWith(2, { search: fastSearch });
    });

    it('should keep latest query value when responses resolve out of order', async () => {
      const unit = readUsers({ slugId });
      const fastResultId = randomString({ prefix: 'fast-result-id' });
      const fastResultName = randomString({ prefix: 'fast-result-name' });
      const slowResultId = randomString({ prefix: 'slow-result-id' });
      const slowResultName = randomString({ prefix: 'slow-result-name' });

      const firstRun = unit.run({ search: slowSearch });
      const secondRun = unit.run({ search: fastSearch });

      fast.resolve([{ id: fastResultId, name: fastResultName }]);
      await secondRun;

      slow.resolve([{ id: slowResultId, name: slowResultName }]);
      await firstRun;

      expect(readUsers({ slugId }).get()).toEqual([
        { id: fastResultId, name: fastResultName },
      ]);
    });
  });
});
