import { bench, describe } from 'vitest';

import { entity, type CacheStorage } from './entity.js';
import { defaultRuntimeQueue } from './runtimeQueue/index.js';
import { source } from './source.js';
import { transform } from './transform.js';
import { view } from './view.js';

interface Todo {
  id: string;
  listId: string;
  title: string;
  completed: boolean;
  updatedAt: number;
}

interface TodoScope {
  listId: string;
}

interface UpdateTodoTitlePayload {
  id: string;
  title: string;
}

interface RemoveAndRestoreTodoPayload {
  id: string;
  restore: Todo;
}

interface MemoryStorageState {
  values: Map<string, string>;
}

interface CreateMemoryStorage {
  (): CacheStorage;
}

interface ReadTodosRunInput {
  payload: readonly Todo[] | undefined;
}

interface ResolveBooleanEnvInput {
  name: string;
  fallback: boolean;
}

interface RuntimeWithProcessEnv {
  process?: {
    env?: Record<string, string | undefined>;
  };
}

const TODO_COUNT = 100_000;
const TODO_LIST_ID = 'bench-list-100k';
const TODO_READ_INDEX = 50_000;
const TODO_WRITE_BASE_ID = 900_000;

const FAST_BENCH_OPTIONS = {
  time: 600,
  warmupTime: 150,
  iterations: 20,
  warmupIterations: 4,
};

const HEAVY_BENCH_OPTIONS = {
  time: 1_200,
  warmupTime: 300,
  iterations: 6,
  warmupIterations: 2,
};

const resolveBooleanEnv = ({
  name,
  fallback,
}: ResolveBooleanEnvInput): boolean => {
  const runtime = globalThis as RuntimeWithProcessEnv;
  const rawValue = runtime.process?.env?.[name];
  if (!rawValue) {
    return fallback;
  }

  const normalizedValue = rawValue.toLowerCase();
  if (normalizedValue === '1' || normalizedValue === 'true' || normalizedValue === 'on') {
    return true;
  }

  if (normalizedValue === '0' || normalizedValue === 'false' || normalizedValue === 'off') {
    return false;
  }

  return fallback;
};

const createTodoDataset = (): readonly Todo[] => {
  return Array.from({ length: TODO_COUNT }, (_unused, index) => {
    return {
      id: `todo-${index}`,
      listId: TODO_LIST_ID,
      title: `Todo #${index}`,
      completed: index % 2 === 0,
      updatedAt: index,
    };
  });
};

const createMemoryStorage = (state: MemoryStorageState): CreateMemoryStorage => {
  return () => {
    return {
      getItem: (key) => {
        return state.values.get(key) ?? null;
      },
      setItem: (key, value) => {
        state.values.set(key, value);
      },
      removeItem: (key) => {
        state.values.delete(key);
      },
    };
  };
};

const waitForAsyncWrite = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('todo performance benchmarks (new dx)', () => {
  const todos = createTodoDataset();
  const seedTodo = todos[TODO_READ_INDEX];
  if (!seedTodo) {
    throw new Error('todo benchmark seed item is missing');
  }

  const todoScope: TodoScope = { listId: TODO_LIST_ID };
  const memoryStorageState: MemoryStorageState = {
    values: new Map<string, string>(),
  };
  const memoryStorage = createMemoryStorage(memoryStorageState)();
  const benchmarkReadWrite = {
    batch: resolveBooleanEnv({
      name: 'LIVON_SYNC_BENCH_BATCH',
      fallback: true,
    }),
    subview: resolveBooleanEnv({
      name: 'LIVON_SYNC_BENCH_SUBVIEW',
      fallback: true,
    }),
  };

  const todosEntity = entity<Todo>({
    idOf: (todo) => todo.id,
    cache: {
      key: 'todo-bench',
      ttl: 'infinity',
      storage: memoryStorage,
    },
    readWrite: benchmarkReadWrite,
  });

  const readTodosRun = async ({ payload }: ReadTodosRunInput): Promise<readonly Todo[] | undefined> => {
    if (!payload) {
      return;
    }

    return payload;
  };

  const readTodos = source<TodoScope, readonly Todo[] | undefined, Todo, readonly Todo[]>({
    entity: todosEntity,
    defaultValue: [],
    run: readTodosRun,
  });

  const writeTodo = source<TodoScope, Todo, Todo, Todo | null>({
    entity: todosEntity,
    run: async ({ payload }) => {
      return payload;
    },
  });

  const removeTodo = source<TodoScope, RemoveAndRestoreTodoPayload, Todo, Todo | null>({
    entity: todosEntity,
    run: async ({ payload }) => {
      return payload.restore;
    },
  });

  const readTodosUnit = readTodos(todoScope);
  const writeTodoUnit = writeTodo(todoScope);
  const removeTodoUnit = removeTodo(todoScope);

  const todoCountView = view<TodoScope, number>({
    out: async ({ get, scope }) => {
      const snapshot = await get(readTodos(scope));
      return snapshot.value.length;
    },
    defaultValue: TODO_COUNT,
  });

  const todoTitleTransform = transform<TodoScope, UpdateTodoTitlePayload, string>({
    out: async ({ get, scope }) => {
      const snapshot = await get(readTodos(scope));
      const found = snapshot.value[TODO_READ_INDEX];
      return found ? found.title : '';
    },
    in: async ({ payload, set }) => {
      await set(writeTodo(todoScope), {
        id: payload.id,
        listId: TODO_LIST_ID,
        title: payload.title,
        completed: false,
        updatedAt: Date.now(),
      });
    },
    defaultValue: seedTodo.title,
  });

  const todoCountViewUnit = todoCountView(todoScope);
  const todoTitleTransformUnit = todoTitleTransform(todoScope);

  let seedPromise: Promise<void> | null = null;
  const ensureSeeded = (): Promise<void> => {
    if (seedPromise) {
      return seedPromise;
    }

    seedPromise = (async () => {
      await readTodosUnit.run(todos);
      defaultRuntimeQueue.flush();
      await waitForAsyncWrite();
    })();

    return seedPromise;
  };

  bench('todo entity read by id after 100_000 seed', async () => {
    await ensureSeeded();
    const readTodoById = todosEntity.getById(seedTodo.id);
    if (!readTodoById) {
      throw new Error('todo entity read benchmark expected an existing todo');
    }
  }, FAST_BENCH_OPTIONS);

  let writeSequence = 0;
  bench('todo entity write upsert one after 100_000 seed', async () => {
    await ensureSeeded();
    const nextWriteId = `${TODO_WRITE_BASE_ID + writeSequence}`;
    writeSequence += 1;
    await writeTodoUnit.run({
      id: nextWriteId,
      listId: TODO_LIST_ID,
      title: `Write #${nextWriteId}`,
      completed: false,
      updatedAt: writeSequence,
    });
  }, FAST_BENCH_OPTIONS);

  bench('todo entity remove one plus restore after 100_000 seed', async () => {
    await ensureSeeded();
    await removeTodoUnit.run({
      id: seedTodo.id,
      restore: seedTodo,
    });
  }, FAST_BENCH_OPTIONS);

  bench('todo source get 100_000 entries', async () => {
    await ensureSeeded();
    const value = readTodosUnit.get();
    const first = value[TODO_READ_INDEX];
    if (!first) {
      throw new Error('todo source get benchmark expected seeded entries');
    }
  }, FAST_BENCH_OPTIONS);

  bench('todo view get access after 100_000 seed', async () => {
    await ensureSeeded();
    const value = todoCountViewUnit.get().value;
    if (value <= 0) {
      throw new Error('todo view get benchmark expected value greater than zero');
    }
  }, FAST_BENCH_OPTIONS);

  bench('todo transform get access after 100_000 seed', async () => {
    await ensureSeeded();
    const value = todoTitleTransformUnit.get().value;
    if (typeof value !== 'string') {
      throw new Error('todo transform get benchmark expected string value');
    }
  }, FAST_BENCH_OPTIONS);

  let transformSequence = 0;
  bench('todo transform set access after 100_000 seed', async () => {
    await ensureSeeded();
    const sequenceId = `${TODO_WRITE_BASE_ID + transformSequence}`;
    transformSequence += 1;
    await todoTitleTransformUnit.set({
      id: sequenceId,
      title: `Transform #${sequenceId}`,
    });
  }, FAST_BENCH_OPTIONS);

  bench('todo source cache rehydrate 100_000 entries', async () => {
    await ensureSeeded();
    const nextEntity = entity<Todo>({
      idOf: (todo) => todo.id,
      readWrite: benchmarkReadWrite,
    });
    const nextReadTodos = source<TodoScope, readonly Todo[] | undefined, Todo, readonly Todo[]>({
      entity: nextEntity,
      defaultValue: [],
      cache: {
        key: 'todo-bench',
        ttl: 'infinity',
        storage: memoryStorage,
      },
      run: readTodosRun,
    });

    const rehydrated = nextReadTodos(todoScope).get();
    if (rehydrated.length !== TODO_COUNT) {
      throw new Error(`todo cache rehydrate benchmark expected ${TODO_COUNT} todos`);
    }
  }, HEAVY_BENCH_OPTIONS);
});
