import { bench, describe } from 'vitest';

import { entity, type CacheConfig } from './entity.js';
import { defaultRuntimeQueue } from './runtimeQueue/index.js';
import { source } from './source.js';
import { source as lazySource } from './sourceLazy.js';
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

interface TodoIdentity {
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

interface ReadTodosRunInput {
  payload: readonly Todo[] | undefined;
  set: (input: readonly Todo[]) => void;
}

interface ResolveBooleanEnvInput {
  name: string;
  fallback: boolean;
}

interface ResolveNumberEnvInput {
  name: string;
  fallback: number;
}

interface ResolveStringEnvInput {
  name: string;
  fallback: string;
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
  executionMode: AsyncExecutionMode;
  useExecutionModeInName: boolean;
  sourceApiMode: SourceApiMode;
  useSourceApiInName: boolean;
}

interface RegisterTodoBenchmarkSuiteInput {
  variant: BenchVariant;
  useVariantInName: boolean;
  executionMode: AsyncExecutionMode;
  useExecutionModeInName: boolean;
  sourceApiMode: SourceApiMode;
  useSourceApiInName: boolean;
  todoIdentity: TodoIdentity;
  todos: readonly Todo[];
  seedTodo: Todo;
  writeManyPayloads: readonly (readonly Todo[])[];
  setManyPayloads: readonly (readonly Todo[])[];
}

const TODO_COUNT = 10_000;
const TODO_LIST_ID = 'bench-list-10k';
const TODO_WRITE_BASE_ID = 900_000;
const TODO_WRITE_MANY_SIZE = 64;
const TODO_WRITE_MANY_SEQUENCE_COUNT = 64;
const TODO_SET_MANY_SIZE = 64;
const TODO_SET_MANY_SEQUENCE_COUNT = 64;
const ASYNC_BENCH_PARALLELISM = 4;
type AsyncExecutionMode = 'parallel' | 'sequential';
const BENCH_EXECUTION_MODES: readonly AsyncExecutionMode[] = ['parallel', 'sequential'];
type SourceApiMode = 'direct' | 'lazy';
const SOURCE_API_MODES: readonly SourceApiMode[] = ['direct', 'lazy'];

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

const resolveStringEnv = ({
  name,
  fallback,
}: ResolveStringEnvInput): string => {
  const runtime = globalThis as RuntimeWithProcessEnv;
  const rawValue = runtime.process?.env?.[name];
  if (!rawValue) {
    return fallback;
  }

  const normalizedValue = rawValue.trim();
  if (normalizedValue.length === 0) {
    return fallback;
  }

  return normalizedValue;
};

const isAsyncExecutionMode = (
  value: string,
): value is AsyncExecutionMode => {
  return BENCH_EXECUTION_MODES.some((mode) => {
    return mode === value;
  });
};

const resolveExecutionMode = (): AsyncExecutionMode => {
  const rawExecutionMode = resolveStringEnv({
    name: 'LIVON_SYNC_BENCH_EXECUTION_MODE',
    fallback: 'parallel',
  }).toLowerCase();

  if (isAsyncExecutionMode(rawExecutionMode)) {
    return rawExecutionMode;
  }

  return 'parallel';
};

const isSourceApiMode = (
  value: string,
): value is SourceApiMode => {
  return SOURCE_API_MODES.some((mode) => {
    return mode === value;
  });
};

const resolveSourceApiMode = (): SourceApiMode => {
  const rawSourceApiMode = resolveStringEnv({
    name: 'LIVON_SYNC_BENCH_SOURCE_API',
    fallback: 'direct',
  }).toLowerCase();

  if (isSourceApiMode(rawSourceApiMode)) {
    return rawSourceApiMode;
  }

  return 'direct';
};

interface CreateTodoDatasetInput {
  todoCount: number;
}

const createTodoDataset = ({
  todoCount,
}: CreateTodoDatasetInput): readonly Todo[] => {
  return Array.from({ length: todoCount }, (_unused, index) => {
    return {
      id: `todo-${index}`,
      listId: TODO_LIST_ID,
      title: `Todo #${index}`,
      completed: index % 2 === 0,
      updatedAt: index,
    };
  });
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

const runInParallel = async (
  operations: readonly (() => Promise<void>)[],
): Promise<void> => {
  await Promise.all(operations.map((operation) => {
    return operation();
  }));
};

const runInSequence = async (
  operations: readonly (() => Promise<void>)[],
): Promise<void> => {
  await operations.reduce((previousOperationPromise, operation) => {
    return previousOperationPromise.then(() => {
      return operation();
    });
  }, Promise.resolve());
};

interface RunByExecutionModeInput {
  executionMode: AsyncExecutionMode;
  operations: readonly (() => Promise<void>)[];
}

const runByExecutionMode = async ({
  executionMode,
  operations,
}: RunByExecutionModeInput): Promise<void> => {
  if (executionMode === 'parallel') {
    await runInParallel(operations);
    return;
  }

  await runInSequence(operations);
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
  executionMode,
  useExecutionModeInName,
  sourceApiMode,
  useSourceApiInName,
}: ResolveBenchmarkNameInput): string => {
  const nameSuffixes = [
    useVariantInName ? variant.label : null,
    useExecutionModeInName ? `mode:${executionMode}` : null,
    useSourceApiInName ? `source:${sourceApiMode}` : null,
  ].filter((entry): entry is string => {
    return Boolean(entry);
  });

  if (nameSuffixes.length === 0) {
    return baseName;
  }

  return `${baseName} | ${nameSuffixes.join(' | ')}`;
};

describe('todo performance benchmarks (new dx)', () => {
  const todoCount = TODO_COUNT;
  const todoReadIndex = Math.min(todoCount - 1, Math.floor(todoCount / 2));
  const todos = createTodoDataset({
    todoCount,
  });
  const seedTodo = todos[todoReadIndex];
  if (!seedTodo) {
    throw new Error('todo benchmark seed item is missing');
  }

  const todoIdentity: TodoIdentity = { listId: TODO_LIST_ID };
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
  const runExecutionModeMatrix = resolveBooleanEnv({
    name: 'LIVON_SYNC_BENCH_EXECUTION_MODE_MATRIX',
    fallback: false,
  });
  const runSourceApiMatrix = resolveBooleanEnv({
    name: 'LIVON_SYNC_BENCH_SOURCE_API_MATRIX',
    fallback: false,
  });
  const configuredExecutionMode = resolveExecutionMode();
  const configuredSourceApiMode = resolveSourceApiMode();
  const benchmarkCacheEnabled = resolveBooleanEnv({
    name: 'LIVON_SYNC_BENCH_CACHE_ENABLED',
    fallback: true,
  });

  const readTodosRun = async ({ payload, set }: ReadTodosRunInput): Promise<void> => {
    if (!payload) {
      return;
    }

    set(payload);
  };

  const configuredVariant = createBenchVariant({
    key: `configured-${benchmarkReadWrite.batch ? 'batch-on' : 'batch-off'}_${benchmarkReadWrite.subview ? 'subview-on' : 'subview-off'}`,
    readWrite: benchmarkReadWrite,
  });

  const activeVariants = runVisualMatrix
    ? DEFAULT_BENCH_VARIANTS
    : [configuredVariant];
  const activeExecutionModes: readonly AsyncExecutionMode[] = runExecutionModeMatrix
    ? BENCH_EXECUTION_MODES
    : [configuredExecutionMode];
  const activeSourceApiModes: readonly SourceApiMode[] = runSourceApiMatrix
    ? SOURCE_API_MODES
    : [configuredSourceApiMode];
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
    executionMode,
    useExecutionModeInName,
    sourceApiMode,
    useSourceApiInName,
    todoIdentity: benchmarkIdentity,
    todos: benchmarkTodos,
    seedTodo: benchmarkSeedTodo,
    writeManyPayloads: benchmarkWriteManyPayloads,
    setManyPayloads: benchmarkSetManyPayloads,
  }: RegisterTodoBenchmarkSuiteInput): void => {
    const cacheKey = [
      'todo-bench',
      useVariantInName ? variant.key : null,
      useExecutionModeInName ? executionMode : null,
      useSourceApiInName ? sourceApiMode : null,
    ].filter((entry): entry is string => {
      return Boolean(entry);
    }).join('-');
    const cacheConfig: CacheConfig | undefined = benchmarkCacheEnabled
      ? {
        key: cacheKey,
        ttl: 'infinity',
        lruMaxEntries: benchmarkCacheLruMaxEntries,
      }
      : undefined;
    const todosEntity = entity<Todo>({
      key: `${cacheKey}-entity`,
      idOf: (todo) => todo.id,
      cache: cacheConfig,
      readWrite: variant.readWrite,
    });
    const createSource = sourceApiMode === 'lazy'
      ? lazySource
      : source;
    const createManySource = createSource({
      entity: todosEntity,
      mode: 'many',
    });
    const createOneSource = createSource({
      entity: todosEntity,
      mode: 'one',
    });

    const readTodos = createManySource<TodoIdentity, readonly Todo[] | undefined>({
      key: `${cacheKey}-read-many`,
      defaultValue: [],
      run: readTodosRun,
    });

    const writeTodo = createOneSource<TodoIdentity, Todo>({
      key: `${cacheKey}-write-one`,
      run: async ({ payload, set }) => {
        set(payload);
      },
    });
    const writeTodosMany = createManySource<TodoIdentity, readonly Todo[]>({
      key: `${cacheKey}-write-many`,
      defaultValue: [],
      run: async ({ payload, set }) => {
        set(payload);
      },
    });

    const removeTodo = createOneSource<TodoIdentity, RemoveAndRestoreTodoPayload>({
      key: `${cacheKey}-remove-restore`,
      run: async ({ payload, deleteOne, upsertOne }) => {
        deleteOne(payload.id);
        upsertOne(payload.restore);
      },
    });

    const readTodosUnit = readTodos(benchmarkIdentity);
    const writeTodoUnit = writeTodo(benchmarkIdentity);
    const writeTodosManyUnit = writeTodosMany(benchmarkIdentity);
    const removeTodoUnit = removeTodo(benchmarkIdentity);

    const todoCountView = view<TodoIdentity, number>({
      out: async ({ get, identity }) => {
        const snapshot = await get(readTodos(identity));
        return snapshot.value.length;
      },
      defaultValue: todoCount,
    });

    const todoTitleTransform = transform<TodoIdentity, UpdateTodoTitlePayload, string>({
      out: async ({ get, identity }) => {
        const snapshot = await get(readTodos(identity));
        const found = snapshot.value[todoReadIndex];
        return found ? found.title : '';
      },
      in: async ({ payload, set }) => {
        await set(writeTodo(benchmarkIdentity), {
          id: payload.id,
          listId: TODO_LIST_ID,
          title: payload.title,
          completed: false,
          updatedAt: Date.now(),
        });
      },
      defaultValue: benchmarkSeedTodo.title,
    });

    const todoCountViewUnit = todoCountView(benchmarkIdentity);
    const todoTitleTransformUnit = todoTitleTransform(benchmarkIdentity);
    const removeAndRestoreSeedTodos = Array.from(
      { length: ASYNC_BENCH_PARALLELISM },
      (_unused, offset) => {
        const candidate = benchmarkTodos[(todoReadIndex + offset) % benchmarkTodos.length];
        if (!candidate) {
          throw new Error('todo remove benchmark seed item is missing');
        }

        return candidate;
      },
    );

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

    const resolveSuiteBenchmarkName = (
      baseName: string,
    ): string => {
      return resolveBenchmarkName({
        baseName,
        variant,
        useVariantInName,
        executionMode,
        useExecutionModeInName,
        sourceApiMode,
        useSourceApiInName,
      });
    };

    bench(resolveSuiteBenchmarkName('todo entity read by id after 10_000 seed'), async () => {
      await ensureSeeded();
      const readTodoById = todosEntity.getById(benchmarkSeedTodo.id);
      if (!readTodoById) {
        throw new Error('todo entity read benchmark expected an existing todo');
      }
    }, FAST_BENCH_OPTIONS);

    let writeSequence = 0;
    bench(resolveSuiteBenchmarkName('todo entity write upsert one after 10_000 seed'), async () => {
      await ensureSeeded();
      const payloads = Array.from({ length: ASYNC_BENCH_PARALLELISM }, () => {
        const nextWriteId = `${TODO_WRITE_BASE_ID + writeSequence}`;
        writeSequence += 1;
        return {
          id: nextWriteId,
          listId: TODO_LIST_ID,
          title: `Write #${nextWriteId}`,
          completed: false,
          updatedAt: writeSequence,
        };
      });

      await runByExecutionMode({
        executionMode,
        operations: payloads.map((payload) => {
          return async () => {
            await writeTodoUnit.run(payload);
          };
        }),
      });
    }, FAST_BENCH_OPTIONS);

    let writeManySequence = 0;
    bench(resolveSuiteBenchmarkName(`todo entity write upsert many(${TODO_WRITE_MANY_SIZE}) after 10_000 seed`), async () => {
      await ensureSeeded();
      const payloads = Array.from({ length: ASYNC_BENCH_PARALLELISM }, () => {
        const payload = benchmarkWriteManyPayloads[writeManySequence % benchmarkWriteManyPayloads.length];
        writeManySequence += 1;
        if (!payload) {
          throw new Error('todo entity write many benchmark payload is missing');
        }

        return payload;
      });

      await runByExecutionMode({
        executionMode,
        operations: payloads.map((payload) => {
          return async () => {
            await writeTodosManyUnit.run(payload);
          };
        }),
      });
    }, FAST_BENCH_OPTIONS);

    bench(resolveSuiteBenchmarkName('todo entity remove one plus restore after 10_000 seed'), async () => {
      await ensureSeeded();
      await runByExecutionMode({
        executionMode,
        operations: removeAndRestoreSeedTodos.map((seedTodo) => {
          return async () => {
            await removeTodoUnit.run({
              id: seedTodo.id,
              restore: seedTodo,
            });
          };
        }),
      });
    }, FAST_BENCH_OPTIONS);

    bench(resolveSuiteBenchmarkName('todo source get 10_000 entries'), async () => {
      await ensureSeeded();
      const checks = Array.from({ length: ASYNC_BENCH_PARALLELISM }, () => {
        return async () => {
          const value = readTodosUnit.getSnapshot().value;
          const first = value[todoReadIndex];
          if (!first) {
            throw new Error('todo source get benchmark expected seeded entries');
          }
        };
      });

      await runByExecutionMode({
        executionMode,
        operations: checks,
      });
    }, FAST_BENCH_OPTIONS);

    bench(resolveSuiteBenchmarkName('todo view get access after 10_000 seed'), async () => {
      await ensureSeeded();
      const checks = Array.from({ length: ASYNC_BENCH_PARALLELISM }, () => {
        return async () => {
          const value = todoCountViewUnit.getSnapshot().value;
          if (value <= 0) {
            throw new Error('todo view get benchmark expected value greater than zero');
          }
        };
      });

      await runByExecutionMode({
        executionMode,
        operations: checks,
      });
    }, FAST_BENCH_OPTIONS);

    bench(resolveSuiteBenchmarkName('todo transform get access after 10_000 seed'), async () => {
      await ensureSeeded();
      const checks = Array.from({ length: ASYNC_BENCH_PARALLELISM }, () => {
        return async () => {
          const value = todoTitleTransformUnit.getSnapshot().value;
          if (typeof value !== 'string') {
            throw new Error('todo transform get benchmark expected string value');
          }
        };
      });

      await runByExecutionMode({
        executionMode,
        operations: checks,
      });
    }, FAST_BENCH_OPTIONS);

    let transformSequence = 0;
    bench(resolveSuiteBenchmarkName('todo transform set access after 10_000 seed'), async () => {
      await ensureSeeded();
      const payloads = Array.from({ length: ASYNC_BENCH_PARALLELISM }, () => {
        const sequenceId = `${TODO_WRITE_BASE_ID + transformSequence}`;
        transformSequence += 1;
        return {
          id: sequenceId,
          title: `Transform #${sequenceId}`,
        };
      });

      await runByExecutionMode({
        executionMode,
        operations: payloads.map((payload) => {
          return async () => {
            await todoTitleTransformUnit.run(payload);
          };
        }),
      });
    }, FAST_BENCH_OPTIONS);

    let setManySequence = 0;
    bench(resolveSuiteBenchmarkName(`todo source set many(${TODO_SET_MANY_SIZE}) access after 10_000 seed`), async () => {
      await ensureSeeded();
      const payloads = Array.from({ length: ASYNC_BENCH_PARALLELISM }, () => {
        const payload = benchmarkSetManyPayloads[setManySequence % benchmarkSetManyPayloads.length];
        setManySequence += 1;
        if (!payload) {
          throw new Error('todo source set many benchmark payload is missing');
        }

        return payload;
      });

      await runByExecutionMode({
        executionMode,
        operations: payloads.map((payload) => {
          return async () => {
            await readTodosUnit.run(payload);
          };
        }),
      });
    }, FAST_BENCH_OPTIONS);

    bench(resolveSuiteBenchmarkName('todo source cache rehydrate 10_000 entries'), async () => {
      if (!benchmarkCacheEnabled) {
        return;
      }

      await ensureSeeded();
      const nextEntity = entity<Todo>({
        key: `${cacheKey}-entity-rehydrate`,
        idOf: (todo) => todo.id,
        readWrite: variant.readWrite,
      });
      const nextReadTodos = createSource({
        entity: nextEntity,
        mode: 'many',
      })<TodoIdentity, readonly Todo[] | undefined>({
        key: `${cacheKey}-read-many-rehydrate`,
        defaultValue: [],
        cache: {
          key: cacheKey,
          ttl: 'infinity',
          lruMaxEntries: benchmarkCacheLruMaxEntries,
        },
        run: readTodosRun,
      });

      const rehydratedLength = nextReadTodos(benchmarkIdentity).getSnapshot().value.length;
      if (rehydratedLength < 0) {
        throw new Error('todo cache rehydrate benchmark produced invalid length');
      }
    }, REHYDRATE_BENCH_OPTIONS);
  };

  activeVariants.forEach((variant) => {
    activeExecutionModes.forEach((executionMode) => {
      activeSourceApiModes.forEach((sourceApiMode) => {
        registerTodoBenchmarkSuite({
          variant,
          useVariantInName: runVisualMatrix,
          executionMode,
          useExecutionModeInName: runExecutionModeMatrix,
          sourceApiMode,
          useSourceApiInName: runSourceApiMatrix,
          todoIdentity,
          todos,
          seedTodo,
          writeManyPayloads,
          setManyPayloads,
        });
      });
    });
  });
});
