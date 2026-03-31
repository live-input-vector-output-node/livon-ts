import { beforeEach, describe, expect, it, vi } from 'vitest';

import { action } from './action.js';
import { configureLazy } from './configureLazy.js';
import { entity } from './entity.js';
import { source } from './source.js';

interface Todo {
  id: string;
  title: string;
}

interface TodoIdentity {
  listId: string;
}

interface ReadTodosPayload {
  query: string;
}

describe('lazy wrappers', () => {
  beforeEach(() => {
    configureLazy();
  });

  describe('source', () => {
    it('should dedupe in-flight load calls for same identity and payload', async () => {
      let releaseRun: (() => void) | undefined;
      const waitForRunStart = async (
        remainingChecks = 5_000,
      ): Promise<void> => {
        if (releaseRun) {
          return;
        }

        if (remainingChecks <= 0) {
          throw new Error('Timed out while waiting for lazy source run start.');
        }

        await new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        });
        return waitForRunStart(remainingChecks - 1);
      };
      const runMock = vi.fn(async ({ payload, upsertMany }) => {
        await new Promise<void>((resolve) => {
          releaseRun = resolve;
        });
        upsertMany([
          {
            id: `todo-${payload.query}`,
            title: payload.query,
          },
        ]);
      });
      const todoEntity = entity<Todo>({
        key: 'lazy-source-dedupe-entity',
        idOf: ({ id }) => id,
      });
      const readTodos = source({
        entity: todoEntity,
        mode: 'many',
      })<TodoIdentity, ReadTodosPayload>({
        key: 'lazy-source-dedupe',
        defaultValue: [],
        run: runMock,
      });
      const identity = {
        listId: 'list-1',
      };
      const firstUnit = readTodos(identity);
      const secondUnit = readTodos(identity);

      const firstLoad = firstUnit.getSnapshot().load({
        query: 'open',
      });
      const secondLoad = secondUnit.getSnapshot().load({
        query: 'open',
      });

      await waitForRunStart();
      expect(runMock).toHaveBeenCalledTimes(1);
      if (!releaseRun) {
        throw new Error('Expected lazy source run release function to be set.');
      }
      releaseRun();

      await Promise.all([firstLoad, secondLoad]);
    });

    it('should forward refetch and force to source run execution modes', async () => {
      const runMock = vi.fn(({ payload, upsertMany }) => {
        upsertMany([
          {
            id: `todo-${payload.query}`,
            title: payload.query,
          },
        ]);
      });
      const todoEntity = entity<Todo>({
        key: 'lazy-source-forwarding-entity',
        idOf: ({ id }) => id,
      });
      const readTodos = source({
        entity: todoEntity,
        mode: 'many',
      })<TodoIdentity, ReadTodosPayload>({
        key: 'lazy-source-forwarding',
        ttl: 60_000,
        defaultValue: [],
        run: runMock,
      });
      const unit = readTodos({
        listId: 'list-2',
      });

      await unit.getSnapshot().load({
        query: 'open',
      });
      await unit.getSnapshot().load();
      await unit.getSnapshot().refetch();
      await unit.getSnapshot().force();

      expect(runMock).toHaveBeenCalledTimes(3);
    });

    it('should bridge listeners and cache stable snapshots', async () => {
      let titleCounter = 0;
      const todoEntity = entity<Todo>({
        key: 'lazy-source-listener-entity',
        idOf: ({ id }) => id,
      });
      const readTodos = source({
        entity: todoEntity,
        mode: 'many',
      })<TodoIdentity, ReadTodosPayload>({
        key: 'lazy-source-listener',
        defaultValue: [],
        run: ({ payload, upsertMany }) => {
          titleCounter += 1;
          upsertMany([
            {
              id: `todo-${payload.query}`,
              title: `${payload.query}-${titleCounter}`,
            },
          ]);
        },
      });
      const unit = readTodos({
        listId: 'list-3',
      });
      const firstSnapshot = unit.getSnapshot();
      const repeatedSnapshot = unit.getSnapshot();

      expect(repeatedSnapshot).toBe(firstSnapshot);

      const listener = vi.fn();
      const unsubscribe = unit.subscribe(listener);
      await unit.getSnapshot().load({
        query: 'active',
      });
      const listenerCallCountAfterLoad = listener.mock.calls.length;
      const afterLoadSnapshot = unit.getSnapshot();
      const afterLoadSnapshotRepeated = unit.getSnapshot();

      expect(listenerCallCountAfterLoad).toBeGreaterThan(0);
      expect(afterLoadSnapshot).not.toBe(firstSnapshot);
      expect(afterLoadSnapshotRepeated).toBe(afterLoadSnapshot);

      unsubscribe?.();
      await unit.getSnapshot().force({
        query: 'active',
      });

      expect(listener.mock.calls.length).toBe(listenerCallCountAfterLoad);
    });
  });

  describe('identity cache cap', () => {
    it('should evict oldest lazy source unit when identity cache limit is exceeded', () => {
      const todoEntity = entity<Todo>({
        key: 'lazy-source-cache-cap-entity',
        idOf: ({ id }) => id,
      });
      const readTodo = source({
        entity: todoEntity,
        mode: 'one',
      })<TodoIdentity>({
        key: 'lazy-source-cache-cap',
        defaultValue: null,
        run: () => undefined,
      });

      const firstUnit = readTodo({
        listId: 'list-1',
      });
      Array.from({ length: 512 }, (_unused, index) => {
        return index + 2;
      }).forEach((listIndex) => {
        readTodo({
          listId: `list-${listIndex}`,
        });
      });
      const firstUnitAfterEviction = readTodo({
        listId: 'list-1',
      });

      expect(firstUnitAfterEviction).not.toBe(firstUnit);
    });

    it('should evict oldest lazy action unit when identity cache limit is exceeded', () => {
      const todoEntity = entity<Todo>({
        key: 'lazy-action-cache-cap-entity',
        idOf: ({ id }) => id,
      });
      const updateTodo = action({
        entity: todoEntity,
        mode: 'one',
      })<TodoIdentity, Todo>({
        key: 'lazy-action-cache-cap',
        defaultValue: null,
        run: ({ payload, upsertOne }) => {
          upsertOne(payload);
        },
      });

      const firstUnit = updateTodo({
        listId: 'list-a',
      });
      Array.from({ length: 512 }, (_unused, index) => {
        return index + 1;
      }).forEach((listIndex) => {
        updateTodo({
          listId: `list-${listIndex}`,
        });
      });
      const firstUnitAfterEviction = updateTodo({
        listId: 'list-a',
      });

      expect(firstUnitAfterEviction).not.toBe(firstUnit);
    });
  });
});
