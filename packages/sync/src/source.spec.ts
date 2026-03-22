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

type UsersResult = readonly User[];
type UsersEntity = Entity<User>;
type ReadUsersSource = Source<UserSlug, SearchPayload, UsersResult, UsersResult>;

describe('source()', () => {
  let runMock = vi.fn();
  let usersEntity: UsersEntity;
  let readUsers: ReadUsersSource;
  let slugId: number;
  let searchValue: string;

  beforeEach(() => {
    slugId = randomNumber();
    searchValue = randomString({ prefix: 'search' });

    runMock = vi.fn(async ({ payload, upsertMany }) => {
      upsertMany([{ id: payload.search, name: payload.search }]);
    });

    usersEntity = entity<User>({
      idOf: (value) => value.id,
      ttl: 30_000,
    });

    readUsers = source<UserSlug, SearchPayload, User, UsersResult, UsersResult>({
      entity: usersEntity,
      ttl: 60_000,
      run: runMock,
    });
  });

  describe('happy', () => {
    it('should not call run handler before unit.run is invoked', () => {
      readUsers({ slugId });

      expect(runMock).not.toHaveBeenCalled();
    });

    it('should call run handler once when unit.run is invoked once', async () => {
      const usersStore = readUsers({ slugId });

      await usersStore.run({ search: searchValue });

      expect(runMock).toHaveBeenCalledTimes(1);
    });

    it('should pass scope to run handler when unit.run is invoked', async () => {
      const usersStore = readUsers({ slugId });

      await usersStore.run({ search: searchValue });

      expect(runMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ scope: { slugId } }),
      );
    });

    it('should pass payload to run handler when unit.run is invoked', async () => {
      const usersStore = readUsers({ slugId });

      await usersStore.run({ search: searchValue });

      expect(runMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ payload: { search: searchValue } }),
      );
    });

    it('should expose run function when source unit is created', () => {
      const usersStore = readUsers({ slugId });

      expect(typeof usersStore.run).toBe('function');
    });

    it('should expose get function when source unit is created', () => {
      const usersStore = readUsers({ slugId });

      expect(typeof usersStore.get).toBe('function');
    });

    it('should expose set function when source unit is created', () => {
      const usersStore = readUsers({ slugId });

      expect(typeof usersStore.set).toBe('function');
    });

    it('should expose effect function when source unit is created', () => {
      const usersStore = readUsers({ slugId });

      expect(typeof usersStore.effect).toBe('function');
    });

    it('should expose refetch function when source unit is created', () => {
      const usersStore = readUsers({ slugId });

      expect(typeof usersStore.refetch).toBe('function');
    });

    it('should expose force function when source unit is created', () => {
      const usersStore = readUsers({ slugId });

      expect(typeof usersStore.force).toBe('function');
    });

    it('should expose stop function when source unit is created', () => {
      const usersStore = readUsers({ slugId });

      expect(typeof usersStore.stop).toBe('function');
    });

    it('should expose destroy function when source unit is created', () => {
      const usersStore = readUsers({ slugId });

      expect(typeof usersStore.destroy).toBe('function');
    });

    it('should return loaded value when run completed', async () => {
      const usersStore = readUsers({ slugId });

      await usersStore.run({ search: searchValue });

      expect(usersStore.get()).toEqual([{ id: searchValue, name: searchValue }]);
    });

    it('should notify effect listener when set is called', () => {
      const usersStore = readUsers({ slugId });
      const listener = vi.fn();
      const firstSetId = randomString({ prefix: 'set-id' });
      const firstSetName = randomString({ prefix: 'set-name' });

      usersStore.effect(listener);
      usersStore.set([{ id: firstSetId, name: firstSetName }]);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should update value when set receives callback', () => {
      const usersStore = readUsers({ slugId });
      const firstSetId = randomString({ prefix: 'set-id' });
      const firstSetName = randomString({ prefix: 'set-name' });
      const secondSetId = randomString({ prefix: 'set-id' });
      const secondSetName = randomString({ prefix: 'set-name' });

      usersStore.set([{ id: firstSetId, name: firstSetName }]);
      usersStore.set((oldValue) => [...oldValue, { id: secondSetId, name: secondSetName }]);

      expect(usersStore.get()).toEqual([
        { id: firstSetId, name: firstSetName },
        { id: secondSetId, name: secondSetName },
      ]);
    });
  });
});
