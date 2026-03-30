import { afterEach, describe, expect, it, vi } from 'vitest';

import { action } from './action/index.js';
import { entity, type CacheConfig, type Entity } from './entity.js';
import { source } from './source/index.js';
import type { SourceRunContext } from './source/index.js';
import { stream } from './stream/index.js';
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
type TodoEntity = Entity<Todo>;

interface CreateReadTodosSourceInput {
  key: string;
  entity: TodoEntity;
  run: (context: ReadTodosRunContext) => Promise<void> | void;
  cache?: CacheConfig;
}

const createTodoEntity = (key = 'todo-entity') => {
  return entity<Todo>({
    key,
    idOf: (value) => value.id,
  });
};
const createReadTodosSource = ({
  key,
  entity: todoEntity,
  run,
  cache,
}: CreateReadTodosSourceInput) => {
  return source({
    entity: todoEntity,
    mode: 'many',
  })<TodoIdentity, ReadTodosPayload>({
    key,
    defaultValue: [],
    cache,
    run,
  });
};
const createMemoryStorage = (): IndexedDbCacheStorage => {
  const values = new Map<string, unknown>();
  return {
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
    readStatus: () => {
      return 'ready';
    },
    isFailed: () => {
      return false;
    },
    readFailure: () => {
      return null;
    },
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

      const readTodos = createReadTodosSource({
        key: 'read-todos',
        entity: todoEntity,
        run: runMock,
      });

      const unit = readTodos({
        listId: 'list-1',
      });

      await unit.getSnapshot().load({ query: 'open' });

      const setActionMock = vi.fn((previous) => {
        expect(previous.snapshot.value[0]?.title).toBe('open');
        expect(previous.data).toEqual({ query: 'open' });
        return { query: 'mine' };
      });

      await unit.getSnapshot().load(setActionMock, { mode: 'force' });

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

      const readTodos = createReadTodosSource({
        key: 'read-todos',
        entity: todoEntity,
        run: runMock,
      });

      const unit = readTodos({
        listId: 'list-1',
      });

      await unit.getSnapshot().load({ query: 'open' });

      await unit.getSnapshot().load(() => undefined, { mode: 'refetch' });

      expect(runMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          payload: { query: 'open' },
        }),
      );
    });

    it('should resolve action run input from setAction callback', async () => {
      const todoEntity = createTodoEntity();
      const updateTodo = action({
        entity: todoEntity,
        mode: 'one',
      })<TodoIdentity, UpdateTodoPayload>({
        key: 'update-todo',
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

      await unit.getSnapshot().submit({
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

      await unit.getSnapshot().submit(setActionMock, {});

      expect(setActionMock).toHaveBeenCalledTimes(1);
      expect(unit.getSnapshot().value?.title).toBe('second');
    });

    it('should resolve stream run input from setAction callback', async () => {
      const todoEntity = createTodoEntity();
      const onTodoChanged = stream({
        entity: todoEntity,
        mode: 'one',
      })<TodoIdentity, Todo>({
        key: 'todo-stream',
        run: async ({ payload, upsertOne }) => {
          upsertOne(payload);
        },
        defaultValue: null,
      });

      const unit = onTodoChanged({
        listId: 'list-1',
      });

      await unit.getSnapshot().start({
        id: 'todo-1',
        title: 'first',
        completed: false,
      });

      await unit.getSnapshot().start((previous, config) => {
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
      const readTodosWriter = createReadTodosSource({
        key: 'read-todos',
        entity: writerEntity,
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
      await writerUnit.getSnapshot().load({
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
      const readTodosReader = createReadTodosSource({
        key: 'read-todos',
        entity: readerEntity,
        cache: {
          key: cacheKey,
          ttl: 'infinity',
        },
        run: readerRunMock,
      });
      const readerUnit = readTodosReader({
        listId: 'list-1',
      });

      const runPromise = readerUnit.getSnapshot().load({
        query: 'mine',
      });

      const snapshotDuringRefresh = readerUnit.getSnapshot();
      expect(snapshotDuringRefresh.value[0]?.title).toBe('open');
      expect(snapshotDuringRefresh.status).toBe('refreshing');
      expect(snapshotDuringRefresh.context.cacheState).toBe('hit');
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

      const readTodosWriter = createReadTodosSource({
        key: 'read-todos',
        entity: todoEntity,
        cache: {
          ttl: 'infinity',
        },
        run: readTodosRun,
      });
      const writerUnit = readTodosWriter({
        listId: 'list-1',
      });
      await writerUnit.getSnapshot().load({
        query: 'open',
      });
      await Promise.resolve();
      await Promise.resolve();

      const nextTodoEntity = createTodoEntity('todo-cache-entity');
      const readTodosReader = createReadTodosSource({
        key: 'read-todos',
        entity: nextTodoEntity,
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

      const readTodosA = createReadTodosSource({
        key: 'read-todos-a',
        entity: todoEntity,
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
      await unitA.getSnapshot().load({
        query: 'open',
      });
      await Promise.resolve();
      await Promise.resolve();

      const anotherTodoEntity = createTodoEntity('todo-cache-entity-b');
      const readTodosB = createReadTodosSource({
        key: 'read-todos-b',
        entity: anotherTodoEntity,
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
        key: '',
        idOf: (value) => value.id,
      });

      expect(() => {
        createReadTodosSource({
          key: '',
          entity: todoEntity,
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
        createReadTodosSource({
          key: '',
          entity: todoEntity,
          cache: {
            ttl: 'infinity',
          },
          run: async ({ set }) => {
            set([]);
          },
        });
      }).toThrowError('source.key is required when source cache is enabled.');
    });

    it('should disable cache state when cache storage write throws', async () => {
      const writeError = new Error('idb write failed');
      let failed = false;
      const storage: IndexedDbCacheStorage = {
        getItem: () => null,
        setItem: () => {
          failed = true;
          throw writeError;
        },
        removeItem: () => {
          return;
        },
        flush: async () => undefined,
        readStatus: () => {
          if (failed) {
            return 'disabled';
          }

          return 'ready';
        },
        isFailed: () => {
          return failed;
        },
        readFailure: () => {
          if (failed) {
            return writeError;
          }

          return null;
        },
      };
      setSharedIndexedDbCacheStorageForTests(storage);

      const todoEntity = createTodoEntity('todo-cache-entity');
      const readTodos = createReadTodosSource({
        key: 'read-todos',
        entity: todoEntity,
        cache: {
          key: 'todo-cache',
          ttl: 'infinity',
        },
        run: async ({ payload, set }) => {
          set(createTodosForQuery(payload.query));
        },
      });
      const unit = readTodos({
        listId: 'list-1',
      });

      await unit.getSnapshot().load({
        query: 'open',
      });

      const snapshot = unit.getSnapshot();
      expect(snapshot.context.cacheState).toBe('disabled');
      expect(storage.isFailed()).toBe(true);
    });
  });
});
