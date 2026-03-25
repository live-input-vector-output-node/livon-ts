import { bench, describe } from 'vitest';

import { entity, type CacheConfig, type CacheStorage } from './entity.js';
import { defaultRuntimeQueue } from './runtimeQueue/index.js';
import { source } from './source.js';
import { transform } from './transform.js';
import { type EntityReadWriteConfig } from './utils/readWriteStrategy.js';
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

interface ResolveNumberEnvInput {
  name: string;
  fallback: number;
}

interface RuntimeWithProcessEnv {
  process?: {
    env?: Record<string, string | undefined>;
  };
}

interface BenchVariant {
  key: string;
  label: string;
  readWrite: EntityReadWriteConfig;
}

interface CreateBenchVariantInput {
  key: string;
  readWrite: EntityReadWriteConfig;
}

interface ResolveBenchmarkNameInput {
  baseName: string;
  variant: BenchVariant;
  useVariantInName: boolean;
}

interface RegisterTodoBenchmarkSuiteInput {
  variant: BenchVariant;
  useVariantInName: boolean;
  todoScope: TodoScope;
  todos: readonly Todo[];
  seedTodo: Todo;
  memoryStorage: CacheStorage;
  writeManyPayloads: readonly (readonly Todo[])[];
  setManyPayloads: readonly (readonly Todo[])[];
}

const TODO_COUNT = 100_000;
const TODO_LIST_ID = 'bench-list-100k';
const TODO_READ_INDEX = 50_000;
const TODO_WRITE_BASE_ID = 900_000;
const TODO_WRITE_MANY_SIZE = 64;
const TODO_WRITE_MANY_SEQUENCE_COUNT = 64;
const TODO_SET_MANY_SIZE = 64;
const TODO_SET_MANY_SEQUENCE_COUNT = 64;

const FAST_BENCH_OPTIONS = {
  time: 600,
  warmupTime: 150,
  iterations: 20,
  warmupIterations: 4,
};

const REHYDRATE_BENCH_OPTIONS = {
  time: 6_000,
  warmupTime: 800,
  iterations: 4,
  warmupIterations: 1,
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

const resolveNumberEnv = ({
  name,
  fallback,
}: ResolveNumberEnvInput): number => {
  const runtime = globalThis as RuntimeWithProcessEnv;
  const rawValue = runtime.process?.env?.[name];
  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return parsedValue;
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

interface CreateTodoBatchInput {
  baseId: number;
  size: number;
  titlePrefix: string;
}

const createTodoBatch = ({
  baseId,
  size,
  titlePrefix,
}: CreateTodoBatchInput): readonly Todo[] => {
  return Array.from({ length: size }, (_unused, index) => {
    const id = `${baseId + index}`;
    return {
      id,
      listId: TODO_LIST_ID,
      title: `${titlePrefix} #${id}`,
      completed: index % 2 === 0,
      updatedAt: baseId + index,
    };
  });
};

interface CreateTodoBatchesInput {
  sequenceCount: number;
  size: number;
  baseIdStart: number;
  titlePrefix: string;
}

const createTodoBatches = ({
  sequenceCount,
  size,
  baseIdStart,
  titlePrefix,
}: CreateTodoBatchesInput): readonly (readonly Todo[])[] => {
  return Array.from({ length: sequenceCount }, (_unused, sequence) => {
    return createTodoBatch({
      baseId: baseIdStart + sequence * size,
      size,
      titlePrefix,
    });
  });
};

const waitForAsyncWrite = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const resolveBenchVariantLabel = ({
  batch,
  subview,
}: EntityReadWriteConfig): string => {
  return `batch:${batch ? 'on' : 'off'} subview:${subview ? 'on' : 'off'}`;
};

const createBenchVariant = ({
  key,
  readWrite,
}: CreateBenchVariantInput): BenchVariant => {
  return {
    key,
    label: resolveBenchVariantLabel(readWrite),
    readWrite,
  };
};

const DEFAULT_BENCH_VARIANTS: readonly BenchVariant[] = [
  createBenchVariant({
    key: 'batch-on_subview-on',
    readWrite: {
      batch: true,
      subview: true,
    },
  }),
  createBenchVariant({
    key: 'batch-on_subview-off',
    readWrite: {
      batch: true,
      subview: false,
    },
  }),
  createBenchVariant({
    key: 'batch-off_subview-on',
    readWrite: {
      batch: false,
      subview: true,
    },
  }),
  createBenchVariant({
    key: 'batch-off_subview-off',
    readWrite: {
      batch: false,
      subview: false,
    },
  }),
];

const resolveBenchmarkName = ({
  baseName,
  variant,
  useVariantInName,
}: ResolveBenchmarkNameInput): string => {
  if (!useVariantInName) {
    return baseName;
  }

  return `${baseName} | ${variant.label}`;
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
  const benchmarkReadWrite: EntityReadWriteConfig = {
    batch: resolveBooleanEnv({
      name: 'LIVON_SYNC_BENCH_BATCH',
      fallback: true,
    }),
    subview: resolveBooleanEnv({
      name: 'LIVON_SYNC_BENCH_SUBVIEW',
      fallback: true,
    }),
  };
  const benchmarkCacheLruMaxEntries = resolveNumberEnv({
    name: 'LIVON_SYNC_BENCH_CACHE_LRU_MAX_ENTRIES',
    fallback: 0,
  });

  const runVisualMatrix = resolveBooleanEnv({
    name: 'LIVON_SYNC_BENCH_MATRIX_VISUAL',
    fallback: false,
  });
  const benchmarkCacheEnabled = resolveBooleanEnv({
    name: 'LIVON_SYNC_BENCH_CACHE_ENABLED',
    fallback: true,
  });

  const readTodosRun = async ({ payload }: ReadTodosRunInput): Promise<readonly Todo[] | undefined> => {
    if (!payload) {
      return;
    }

    return payload;
  };

  const configuredVariant = createBenchVariant({
    key: `configured-${benchmarkReadWrite.batch ? 'batch-on' : 'batch-off'}_${benchmarkReadWrite.subview ? 'subview-on' : 'subview-off'}`,
    readWrite: benchmarkReadWrite,
  });

  const activeVariants = runVisualMatrix
    ? DEFAULT_BENCH_VARIANTS
    : [configuredVariant];
  const writeManyPayloads = createTodoBatches({
    sequenceCount: TODO_WRITE_MANY_SEQUENCE_COUNT,
    size: TODO_WRITE_MANY_SIZE,
    baseIdStart: TODO_WRITE_BASE_ID + 10_000,
    titlePrefix: 'WriteMany',
  });
  const setManyPayloads = createTodoBatches({
    sequenceCount: TODO_SET_MANY_SEQUENCE_COUNT,
    size: TODO_SET_MANY_SIZE,
    baseIdStart: TODO_WRITE_BASE_ID + 100_000,
    titlePrefix: 'SetMany',
  });

  const registerTodoBenchmarkSuite = ({
    variant,
    useVariantInName,
    todoScope: benchmarkScope,
    todos: benchmarkTodos,
    seedTodo: benchmarkSeedTodo,
    memoryStorage: benchmarkMemoryStorage,
    writeManyPayloads: benchmarkWriteManyPayloads,
    setManyPayloads: benchmarkSetManyPayloads,
  }: RegisterTodoBenchmarkSuiteInput): void => {
    const cacheKey = useVariantInName ? `todo-bench-${variant.key}` : 'todo-bench';
    const cacheConfig: CacheConfig | undefined = benchmarkCacheEnabled
      ? {
        key: cacheKey,
        ttl: 'infinity',
        lruMaxEntries: benchmarkCacheLruMaxEntries,
        storage: benchmarkMemoryStorage,
      }
      : undefined;
    const todosEntity = entity<Todo>({
      idOf: (todo) => todo.id,
      cache: cacheConfig,
      readWrite: variant.readWrite,
    });

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
    const writeTodosMany = source<TodoScope, readonly Todo[], Todo, readonly Todo[]>({
      entity: todosEntity,
      defaultValue: [],
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

    const readTodosUnit = readTodos(benchmarkScope);
    const writeTodoUnit = writeTodo(benchmarkScope);
    const writeTodosManyUnit = writeTodosMany(benchmarkScope);
    const removeTodoUnit = removeTodo(benchmarkScope);

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
        await set(writeTodo(benchmarkScope), {
          id: payload.id,
          listId: TODO_LIST_ID,
          title: payload.title,
          completed: false,
          updatedAt: Date.now(),
        });
      },
      defaultValue: benchmarkSeedTodo.title,
    });

    const todoCountViewUnit = todoCountView(benchmarkScope);
    const todoTitleTransformUnit = todoTitleTransform(benchmarkScope);

    let seedPromise: Promise<void> | null = null;
    const ensureSeeded = (): Promise<void> => {
      if (seedPromise) {
        return seedPromise;
      }

      seedPromise = (async () => {
        await readTodosUnit.run(benchmarkTodos);
        defaultRuntimeQueue.flush();
        await waitForAsyncWrite();
      })();

      return seedPromise;
    };

    bench(resolveBenchmarkName({
      baseName: 'todo entity read by id after 100_000 seed',
      variant,
      useVariantInName,
    }), async () => {
      await ensureSeeded();
      const readTodoById = todosEntity.getById(benchmarkSeedTodo.id);
      if (!readTodoById) {
        throw new Error('todo entity read benchmark expected an existing todo');
      }
    }, FAST_BENCH_OPTIONS);

    let writeSequence = 0;
    bench(resolveBenchmarkName({
      baseName: 'todo entity write upsert one after 100_000 seed',
      variant,
      useVariantInName,
    }), async () => {
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

    let writeManySequence = 0;
    bench(resolveBenchmarkName({
      baseName: `todo entity write upsert many(${TODO_WRITE_MANY_SIZE}) after 100_000 seed`,
      variant,
      useVariantInName,
    }), async () => {
      await ensureSeeded();
      const payload = benchmarkWriteManyPayloads[writeManySequence % benchmarkWriteManyPayloads.length];
      writeManySequence += 1;
      if (!payload) {
        throw new Error('todo entity write many benchmark payload is missing');
      }

      await writeTodosManyUnit.run(payload);
    }, FAST_BENCH_OPTIONS);

    bench(resolveBenchmarkName({
      baseName: 'todo entity remove one plus restore after 100_000 seed',
      variant,
      useVariantInName,
    }), async () => {
      await ensureSeeded();
      await removeTodoUnit.run({
        id: benchmarkSeedTodo.id,
        restore: benchmarkSeedTodo,
      });
    }, FAST_BENCH_OPTIONS);

    bench(resolveBenchmarkName({
      baseName: 'todo source get 100_000 entries',
      variant,
      useVariantInName,
    }), async () => {
      await ensureSeeded();
      const value = readTodosUnit.get();
      const first = value[TODO_READ_INDEX];
      if (!first) {
        throw new Error('todo source get benchmark expected seeded entries');
      }
    }, FAST_BENCH_OPTIONS);

    bench(resolveBenchmarkName({
      baseName: 'todo view get access after 100_000 seed',
      variant,
      useVariantInName,
    }), async () => {
      await ensureSeeded();
      const value = todoCountViewUnit.get().value;
      if (value <= 0) {
        throw new Error('todo view get benchmark expected value greater than zero');
      }
    }, FAST_BENCH_OPTIONS);

    bench(resolveBenchmarkName({
      baseName: 'todo transform get access after 100_000 seed',
      variant,
      useVariantInName,
    }), async () => {
      await ensureSeeded();
      const value = todoTitleTransformUnit.get().value;
      if (typeof value !== 'string') {
        throw new Error('todo transform get benchmark expected string value');
      }
    }, FAST_BENCH_OPTIONS);

    let transformSequence = 0;
    bench(resolveBenchmarkName({
      baseName: 'todo transform set access after 100_000 seed',
      variant,
      useVariantInName,
    }), async () => {
      await ensureSeeded();
      const sequenceId = `${TODO_WRITE_BASE_ID + transformSequence}`;
      transformSequence += 1;
      await todoTitleTransformUnit.set({
        id: sequenceId,
        title: `Transform #${sequenceId}`,
      });
    }, FAST_BENCH_OPTIONS);

    let setManySequence = 0;
    bench(resolveBenchmarkName({
      baseName: `todo source set many(${TODO_SET_MANY_SIZE}) access after 100_000 seed`,
      variant,
      useVariantInName,
    }), async () => {
      await ensureSeeded();
      const payload = benchmarkSetManyPayloads[setManySequence % benchmarkSetManyPayloads.length];
      setManySequence += 1;
      if (!payload) {
        throw new Error('todo source set many benchmark payload is missing');
      }

      await readTodosUnit.run(payload);
    }, FAST_BENCH_OPTIONS);

    bench(resolveBenchmarkName({
      baseName: 'todo source cache rehydrate 100_000 entries',
      variant,
      useVariantInName,
    }), async () => {
      if (!benchmarkCacheEnabled) {
        return;
      }

      await ensureSeeded();
      const nextEntity = entity<Todo>({
        idOf: (todo) => todo.id,
        readWrite: variant.readWrite,
      });
      const nextReadTodos = source<TodoScope, readonly Todo[] | undefined, Todo, readonly Todo[]>({
        entity: nextEntity,
        defaultValue: [],
        cache: {
          key: cacheKey,
          ttl: 'infinity',
          lruMaxEntries: benchmarkCacheLruMaxEntries,
          storage: benchmarkMemoryStorage,
        },
        run: readTodosRun,
      });

      const rehydratedLength = nextReadTodos(benchmarkScope).get().length;
      if (rehydratedLength < 0) {
        throw new Error('todo cache rehydrate benchmark produced invalid length');
      }
    }, REHYDRATE_BENCH_OPTIONS);
  };

  activeVariants.forEach((variant) => {
    registerTodoBenchmarkSuite({
      variant,
      useVariantInName: runVisualMatrix,
      todoScope,
      todos,
      seedTodo,
      memoryStorage,
      writeManyPayloads,
      setManyPayloads,
    });
  });
});
