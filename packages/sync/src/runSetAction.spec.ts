import { afterEach, describe, expect, it, vi } from 'vitest';

import { action } from './action.js';
import { entity } from './entity.js';
import { source } from './source.js';
import type { SourceRunContext } from './source.js';
import { stream } from './stream.js';
import {
  setSharedIndexedDbCacheStorageForTests,
  type IndexedDbCacheStorage,
} from './utils/indexedDbCacheStorage.js';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

interface TodoIdentity {
  listId: string;
}

interface ReadTodosPayload {
  query: string;
}

interface UpdateTodoPayload {
  id: string;
  title: string;
}

interface Deferred<TValue> {
  promise: Promise<TValue>;
  resolve: (value: TValue | PromiseLike<TValue>) => void;
  reject: (reason?: unknown) => void;
}

type ReadTodosRunContext = SourceRunContext<TodoIdentity, ReadTodosPayload, readonly Todo[]>;

const createTodoEntity = (key = 'todo-entity') => {
  return entity<Todo>({
    key,
    idOf: (value) => value.id,
  });
};
const createMemoryStorage = (): IndexedDbCacheStorage => {
  const values = new Map<string, unknown>();
  return {
    supportsStructuredValues: true,
    getItem: (key) => {
      return values.get(key) ?? null;
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    flush: async () => undefined,
  };
};
const createDeferred = <TValue>(): Deferred<TValue> => {
  let resolveDeferred: Deferred<TValue>['resolve'] = () => undefined;
  let rejectDeferred: Deferred<TValue>['reject'] = () => undefined;
  const promise = new Promise<TValue>((resolve, reject) => {
    resolveDeferred = resolve;
    rejectDeferred = reject;
  });

  return {
    promise,
    resolve: resolveDeferred,
    reject: rejectDeferred,
  };
};
const createTodosForQuery = (query: string): readonly Todo[] => {
  return [
    {
      id: `todo-${query}`,
      title: query,
      completed: false,
    },
  ];
};

describe('run setAction inputs', () => {
  afterEach(() => {
    setSharedIndexedDbCacheStorageForTests(undefined);
  });

  describe('happy', () => {
    it('should resolve source run input from direct setAction callback', async () => {
      const todoEntity = createTodoEntity();
      const runMock = vi.fn(async ({ identity, payload, set }: ReadTodosRunContext) => {
        set([
          {
            id: `${identity.listId}-${payload.query}`,
            title: payload.query,
            completed: false,
          },
        ]);
      });

      const readTodos = source<TodoIdentity, ReadTodosPayload, readonly Todo[]>({
        entity: todoEntity,
        defaultValue: [],
        run: runMock,
      });

      const unit = readTodos({
        listId: 'list-1',
      });

      await unit.run({ query: 'open' });

      const setActionMock = vi.fn((previous) => {
        expect(previous.snapshot.value[0]?.title).toBe('open');
        expect(previous.data).toEqual({ query: 'open' });
        return { query: 'mine' };
      });

      await unit.run(setActionMock, { mode: 'force' });

      expect(setActionMock).toHaveBeenCalledTimes(1);
      expect(runMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          identity: { listId: 'list-1' },
          payload: { query: 'mine' },
        }),
      );
      expect(unit.getSnapshot().value[0]?.title).toBe('mine');
    });

    it('should resolve source run input from config setAction callback', async () => {
      const todoEntity = createTodoEntity();
      const runMock = vi.fn(async ({ payload, set }: ReadTodosRunContext) => {
        set([
          {
            id: payload.query,
            title: payload.query,
            completed: false,
          },
        ]);
      });

      const readTodos = source<TodoIdentity, ReadTodosPayload, readonly Todo[]>({
        entity: todoEntity,
        defaultValue: [],
        run: runMock,
      });

      const unit = readTodos({
        listId: 'list-1',
      });

      await unit.run({ query: 'open' });

      await unit.run(() => undefined, { mode: 'refetch' });

      expect(runMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          payload: { query: 'open' },
        }),
      );
    });

    it('should resolve action run input from setAction callback', async () => {
      const todoEntity = createTodoEntity();
      const updateTodo = action<TodoIdentity, UpdateTodoPayload, Todo | null>({
        entity: todoEntity,
        run: async ({ payload, upsertOne }) => {
          upsertOne({
            id: payload.id,
            title: payload.title,
            completed: false,
          });
        },
        defaultValue: null,
      });

      const unit = updateTodo({
        listId: 'list-1',
      });

      await unit.run({
        id: 'todo-1',
        title: 'first',
      });

      const setActionMock = vi.fn((previous, config) => {
        expect(previous.snapshot.value?.title).toBe('first');
        expect(previous.data).toEqual({
          id: 'todo-1',
          title: 'first',
        });
        expect(config).toEqual({});
        return {
          id: 'todo-1',
          title: 'second',
        };
      });

      await unit.run(setActionMock, {});

      expect(setActionMock).toHaveBeenCalledTimes(1);
      expect(unit.getSnapshot().value?.title).toBe('second');
    });

    it('should resolve stream run input from setAction callback', async () => {
      const todoEntity = createTodoEntity();
      const onTodoChanged = stream<TodoIdentity, Todo, Todo | null>({
        entity: todoEntity,
        run: async ({ payload, upsertOne }) => {
          upsertOne(payload);
        },
        defaultValue: null,
      });

      const unit = onTodoChanged({
        listId: 'list-1',
      });

      await unit.run({
        id: 'todo-1',
        title: 'first',
        completed: false,
      });

      await unit.run((previous, config) => {
        expect(previous.snapshot.value?.title).toBe('first');
        expect(config).toEqual({});
        return {
          id: 'todo-1',
          title: 'second',
          completed: false,
        };
      }, {});

      expect(unit.getSnapshot().value?.title).toBe('second');
    });

    it('should rehydrate newest cached payload and refresh in background when payload changes without direct cache hit', async () => {
      const cacheKey = 'todo-cache-lru-default';
      const storage = createMemoryStorage();

      const writerEntity = createTodoEntity('todo-cache-entity');
      setSharedIndexedDbCacheStorageForTests(storage);
      const readTodosWriter = source<TodoIdentity, ReadTodosPayload, readonly Todo[]>({
        key: 'read-todos',
        entity: writerEntity,
        defaultValue: [],
        cache: {
          key: cacheKey,
          ttl: 'infinity',
        },
        run: async ({ payload, set }) => {
          set(createTodosForQuery(payload.query));
        },
      });
      const writerUnit = readTodosWriter({
        listId: 'list-1',
      });
      await writerUnit.run({
        query: 'open',
      });
      await Promise.resolve();
      await Promise.resolve();

      const readerEntity = createTodoEntity('todo-cache-entity');
      const runDeferred = createDeferred<readonly Todo[]>();
      const readerRunMock = vi.fn(async ({ payload, set }: ReadTodosRunContext) => {
        await runDeferred.promise;
        set(createTodosForQuery(payload.query));
      });
      const readTodosReader = source<TodoIdentity, ReadTodosPayload, readonly Todo[]>({
        key: 'read-todos',
        entity: readerEntity,
        defaultValue: [],
        cache: {
          key: cacheKey,
          ttl: 'infinity',
        },
        run: readerRunMock,
      });
      const readerUnit = readTodosReader({
        listId: 'list-1',
      });

      const runPromise = readerUnit.run({
        query: 'mine',
      });

      const snapshotDuringRefresh = readerUnit.getSnapshot();
      expect(snapshotDuringRefresh.value[0]?.title).toBe('open');
      expect(snapshotDuringRefresh.status).toBe('refreshing');
      expect(snapshotDuringRefresh.context.cacheState).toBe('stale');
      expect(readerRunMock).toHaveBeenCalledTimes(1);
      expect(readerRunMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          payload: {
            query: 'mine',
          },
        }),
      );

      runDeferred.resolve(createTodosForQuery('mine'));
      await runPromise;

      const snapshotAfterRefresh = readerUnit.getSnapshot();
      expect(snapshotAfterRefresh.value[0]?.title).toBe('mine');
      expect(snapshotAfterRefresh.status).toBe('success');
    });

    it('should rehydrate cached value for same source when source cache key is omitted', async () => {
      const todoEntity = createTodoEntity('todo-cache-entity');
      const storage = createMemoryStorage();
      setSharedIndexedDbCacheStorageForTests(storage);
      const readTodosRun = async ({ payload, set }: ReadTodosRunContext): Promise<void> => {
        set(createTodosForQuery(payload.query));
      };

      const readTodosWriter = source<TodoIdentity, ReadTodosPayload, readonly Todo[]>({
        key: 'read-todos',
        entity: todoEntity,
        defaultValue: [],
        cache: {
          ttl: 'infinity',
        },
        run: readTodosRun,
      });
      const writerUnit = readTodosWriter({
        listId: 'list-1',
      });
      await writerUnit.run({
        query: 'open',
      });
      await Promise.resolve();
      await Promise.resolve();

      const nextTodoEntity = createTodoEntity('todo-cache-entity');
      const readTodosReader = source<TodoIdentity, ReadTodosPayload, readonly Todo[]>({
        key: 'read-todos',
        entity: nextTodoEntity,
        defaultValue: [],
        cache: {
          ttl: 'infinity',
        },
        run: readTodosRun,
      });
      const readerUnit = readTodosReader({
        listId: 'list-1',
      });

      expect(readerUnit.getSnapshot().value[0]?.title).toBe('open');
    });

    it('should isolate caches between different sources when source cache key is omitted', async () => {
      const todoEntity = createTodoEntity('todo-cache-entity-a');
      const storage = createMemoryStorage();
      setSharedIndexedDbCacheStorageForTests(storage);

      const readTodosA = source<TodoIdentity, ReadTodosPayload, readonly Todo[]>({
        key: 'read-todos-a',
        entity: todoEntity,
        defaultValue: [],
        cache: {
          ttl: 'infinity',
        },
        run: async ({ payload, set }) => {
          set(createTodosForQuery(`a-${payload.query}`));
        },
      });
      const unitA = readTodosA({
        listId: 'list-1',
      });
      await unitA.run({
        query: 'open',
      });
      await Promise.resolve();
      await Promise.resolve();

      const anotherTodoEntity = createTodoEntity('todo-cache-entity-b');
      const readTodosB = source<TodoIdentity, ReadTodosPayload, readonly Todo[]>({
        key: 'read-todos-b',
        entity: anotherTodoEntity,
        defaultValue: [],
        cache: {
          ttl: 'infinity',
        },
        run: async ({ payload, set }) => {
          set(createTodosForQuery(`b-${payload.query}`));
        },
      });
      const unitB = readTodosB({
        listId: 'list-1',
      });

      expect(unitB.getSnapshot().value).toEqual([]);
    });

    it('should throw when cache is enabled without entity and source keys', () => {
      const storage = createMemoryStorage();
      setSharedIndexedDbCacheStorageForTests(storage);
      const todoEntity = entity<Todo>({
        idOf: (value) => value.id,
      });

      expect(() => {
        source<TodoIdentity, ReadTodosPayload, readonly Todo[]>({
          entity: todoEntity,
          defaultValue: [],
          cache: {
            ttl: 'infinity',
          },
          run: async ({ set }) => {
            set([]);
          },
        });
      }).toThrowError('entity.key is required when source cache is enabled.');
    });

    it('should throw when cache is enabled without source key', () => {
      const storage = createMemoryStorage();
      setSharedIndexedDbCacheStorageForTests(storage);
      const todoEntity = createTodoEntity('todo-entity');

      expect(() => {
        source<TodoIdentity, ReadTodosPayload, readonly Todo[]>({
          entity: todoEntity,
          defaultValue: [],
          cache: {
            ttl: 'infinity',
          },
          run: async ({ set }) => {
            set([]);
          },
        });
      }).toThrowError('source.key is required when source cache is enabled.');
    });
  });
});
