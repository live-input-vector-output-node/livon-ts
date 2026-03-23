import { bench, describe } from 'vitest';

import { entity, type CacheStorage } from './entity.js';
import { source } from './source.js';
import { transform } from './transform.js';
import { view } from './view.js';
import { defaultRuntimeQueue } from './runtimeQueue/index.js';

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

interface UnitSnapshot<TValue> {
  value: TValue;
  status: 'idle' | 'loading' | 'success' | 'error';
  meta: unknown;
  context: unknown;
}

interface ViewUnitDx<TValue> {
  get: () => TValue | UnitSnapshot<TValue>;
}

interface TransformUnitDx<TPayload, TValue> {
  get: () => TValue | UnitSnapshot<TValue>;
  set: (payload: TPayload) => Promise<void>;
}

interface MemoryStorageState {
  values: Map<string, string>;
}

interface CreateMemoryStorage {
  (): CacheStorage;
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

const readSnapshotValue = <TValue>(value: TValue | UnitSnapshot<TValue>): TValue => {
  if (typeof value !== 'object' || value === null || !('value' in value)) {
    return value as TValue;
  }

  return (value as UnitSnapshot<TValue>).value;
};

const waitForAsyncWrite = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('todo performance benchmarks (new dx)', () => {
  const todos = createTodoDataset();
  const todoScope: TodoScope = { listId: TODO_LIST_ID };
  const seedTodo = todos[TODO_READ_INDEX] as Todo;
  const memoryStorageState: MemoryStorageState = {
    values: new Map<string, string>(),
  };
  const memoryStorage = createMemoryStorage(memoryStorageState)();

  const todosEntity = entity<Todo>({
    idOf: (todo) => todo.id,
    cache: {
      key: 'todo-bench',
      ttl: 'infinity',
      storage: memoryStorage,
    },
  });

  const readTodosRun = async ({
    payload,
  }: {
    payload: readonly Todo[] | undefined;
  }) => {
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
    out: async (rawContext: unknown) => {
      const context = rawContext as {
        get: (unit: unknown) => Promise<UnitSnapshot<readonly Todo[]>>;
        scope: TodoScope;
      };
      const snapshot = await context.get(readTodos(context.scope));
      return snapshot.value.length;
    },
    defaultValue: TODO_COUNT,
  });

  const todoTitleTransform = transform<TodoScope, UpdateTodoTitlePayload, string>({
    out: async (rawContext: unknown) => {
      const context = rawContext as {
        get: (unit: unknown) => Promise<UnitSnapshot<readonly Todo[]>>;
        scope: TodoScope;
      };
      const snapshot = await context.get(readTodos(context.scope));
      const found = snapshot.value[TODO_READ_INDEX];
      return found ? found.title : '';
    },
    in: async (rawContext: unknown) => {
      const context = rawContext as {
        payload: UpdateTodoTitlePayload;
        set?: (unit: unknown, payload: unknown) => Promise<unknown>;
      };

      if (!context.set) {
        return;
      }

      await context.set(writeTodo(todoScope), {
        id: context.payload.id,
        listId: TODO_LIST_ID,
        title: context.payload.title,
        completed: false,
        updatedAt: Date.now(),
      } satisfies Todo);
    },
    defaultValue: seedTodo ? seedTodo.title : '',
  });

  const todoCountViewUnit = todoCountView(todoScope) as ViewUnitDx<number>;
  const todoTitleTransformUnit = todoTitleTransform(todoScope) as TransformUnitDx<
    UpdateTodoTitlePayload,
    string
  >;

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
    const snapshotOrValue = todoCountViewUnit.get();
    const value = readSnapshotValue(snapshotOrValue);
    if (value <= 0) {
      throw new Error('todo view get benchmark expected value greater than zero');
    }
  }, FAST_BENCH_OPTIONS);

  bench('todo transform get access after 100_000 seed', async () => {
    await ensureSeeded();
    const snapshotOrValue = todoTitleTransformUnit.get();
    const value = readSnapshotValue(snapshotOrValue);
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
