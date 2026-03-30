import { scheduleAsync } from './scheduleAsync.js';

interface IndexedDbObjectStore {
  get: (key: string) => IndexedDbRequest<unknown>;
  put: (value: unknown, key: string) => IndexedDbRequest<unknown>;
  delete: (key: string) => IndexedDbRequest<unknown>;
}

interface IndexedDbTransaction {
  objectStore: (name: string) => IndexedDbObjectStore;
  oncomplete: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
}

interface IndexedDbObjectStoreNames {
  contains: (name: string) => boolean;
}

interface IndexedDbDatabase {
  objectStoreNames: IndexedDbObjectStoreNames;
  createObjectStore: (name: string) => IndexedDbObjectStore;
  transaction: (name: string, mode: 'readonly' | 'readwrite') => IndexedDbTransaction;
}

interface IndexedDbRequest<TResult> {
  result: TResult;
  error: unknown;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}

interface IndexedDbOpenRequest extends IndexedDbRequest<IndexedDbDatabase> {
  onupgradeneeded: (() => void) | null;
}

interface IndexedDbFactory {
  open: (name: string, version?: number) => IndexedDbOpenRequest;
}

interface IndexedDbRuntime {
  indexedDB?: IndexedDbFactory;
}

interface TimeoutRuntime {
  setTimeout: (callback: () => void, delay: number) => unknown;
}

interface IndexedDbWriteOperationSet {
  type: 'set';
  value: unknown;
}

interface IndexedDbWriteOperationDelete {
  type: 'delete';
}

type IndexedDbWriteOperation =
  | IndexedDbWriteOperationSet
  | IndexedDbWriteOperationDelete;

interface ReadManyFromDbInput {
  database: IndexedDbDatabase;
  keys: readonly string[];
  storeName: string;
}

interface WriteManyToDbInput {
  database: IndexedDbDatabase;
  operationsByKey: Map<string, IndexedDbWriteOperation>;
  storeName: string;
}

interface CreateIndexedDbCacheStorageInput {
  dbName?: string;
  storeName?: string;
  version?: number;
  runtime?: IndexedDbRuntime;
  retryDelaysMs?: readonly number[];
}

export interface IndexedDbCacheStorage {
  getItem: (key: string) => unknown | null;
  setItem: (key: string, value: unknown) => void;
  removeItem: (key: string) => void;
  flush: () => Promise<void>;
  readStatus: () => 'ready' | 'degraded' | 'disabled';
  isFailed: () => boolean;
  readFailure: () => unknown;
}

interface ScheduleWithDelayInput {
  delay: number;
  callback: () => void;
}

const DEFAULT_DB_NAME = 'livon-sync-cache';
const DEFAULT_STORE_NAME = 'source-cache';
const DEFAULT_DB_VERSION = 1;
const DEFAULT_RETRY_DELAYS_MS = [200, 1_000, 5_000, 30_000] as const;

let sharedIndexedDbCacheStorage: IndexedDbCacheStorage | undefined;

const isIndexedDbFactory = (value: unknown): value is IndexedDbFactory => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return 'open' in value && typeof value.open === 'function';
};

const hasTimeoutRuntime = (value: unknown): value is TimeoutRuntime => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return 'setTimeout' in value && typeof value.setTimeout === 'function';
};

const readErrorName = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  if (!('name' in error)) {
    return undefined;
  }

  const name = error.name;
  if (typeof name !== 'string') {
    return undefined;
  }

  return name;
};

const normalizeError = (error: unknown): unknown => {
  if (error) {
    return error;
  }

  return new Error('IndexedDB cache failed.');
};

const isPermanentIndexedDbError = (error: unknown): boolean => {
  const name = readErrorName(error);
  if (!name) {
    return false;
  }

  return name === 'SecurityError'
    || name === 'NotSupportedError'
    || name === 'InvalidAccessError';
};

interface ReadRetryDelayInput {
  attempt: number;
  retryDelaysMs: readonly number[];
}

const readRetryDelay = ({
  attempt,
  retryDelaysMs,
}: ReadRetryDelayInput): number => {
  const index = Math.max(0, Math.min(attempt - 1, retryDelaysMs.length - 1));
  const delay = retryDelaysMs[index];
  return delay ?? retryDelaysMs[retryDelaysMs.length - 1] ?? 30_000;
};

const scheduleWithDelay = ({
  delay,
  callback,
}: ScheduleWithDelayInput): void => {
  const runtime = globalThis;
  if (hasTimeoutRuntime(runtime)) {
    runtime.setTimeout(callback, delay);
    return;
  }

  scheduleAsync({
    callback,
  });
};

const readRuntime = (): IndexedDbRuntime => {
  const runtime = globalThis;
  if (!('indexedDB' in runtime)) {
    return {};
  }

  const indexedDbFactory = runtime.indexedDB;
  if (!isIndexedDbFactory(indexedDbFactory)) {
    return {};
  }

  return {
    indexedDB: indexedDbFactory,
  };
};

const readRequestResult = <TResult>(
  request: IndexedDbRequest<TResult>,
): Promise<TResult> => {
  return new Promise<TResult>((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};

const waitForTransaction = (
  transaction: IndexedDbTransaction,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = () => {
      reject(new Error('IndexedDB transaction failed.'));
    };
    transaction.onabort = () => {
      reject(new Error('IndexedDB transaction aborted.'));
    };
  });
};

const readManyFromDb = async ({
  database,
  keys,
  storeName,
}: ReadManyFromDbInput): Promise<Map<string, unknown>> => {
  const valuesByKey = new Map<string, unknown>();
  if (keys.length === 0) {
    return valuesByKey;
  }

  const transaction = database.transaction(storeName, 'readonly');
  const transactionDone = waitForTransaction(transaction);
  const store = transaction.objectStore(storeName);

  const pairs = await Promise.all(keys.map(async (key) => {
    const value = await readRequestResult(store.get(key));
    return {
      key,
      value,
    };
  }));
  await transactionDone;

  pairs.forEach(({ key, value }) => {
    if (value !== undefined) {
      valuesByKey.set(key, value);
    }
  });

  return valuesByKey;
};

const writeManyToDb = async ({
  database,
  operationsByKey,
  storeName,
}: WriteManyToDbInput): Promise<void> => {
  if (operationsByKey.size === 0) {
    return;
  }

  const transaction = database.transaction(storeName, 'readwrite');
  const transactionDone = waitForTransaction(transaction);
  const store = transaction.objectStore(storeName);
  operationsByKey.forEach((operation, key) => {
    if (operation.type === 'set') {
      store.put(operation.value, key);
      return;
    }

    store.delete(key);
  });
  await transactionDone;
};

export const createIndexedDbCacheStorage = ({
  dbName = DEFAULT_DB_NAME,
  storeName = DEFAULT_STORE_NAME,
  version = DEFAULT_DB_VERSION,
  runtime = readRuntime(),
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
}: CreateIndexedDbCacheStorageInput = {}): IndexedDbCacheStorage | undefined => {
  const indexedDbFactory = runtime.indexedDB;
  if (!indexedDbFactory) {
    return undefined;
  }

  const valuesByKey = new Map<string, unknown>();
  const missingKeys = new Set<string>();
  const pendingReadKeys = new Set<string>();
  const pendingWriteOperationsByKey = new Map<string, IndexedDbWriteOperation>();
  let readsScheduled = false;
  let writesScheduled = false;
  let readsInFlight = false;
  let writesInFlight = false;
  let reconnectScheduled = false;
  let reconnectInFlight = false;
  let transientFailureCount = 0;
  let failure: unknown = null;
  let status: 'ready' | 'degraded' | 'disabled' = 'ready';
  let databasePromise: Promise<IndexedDbDatabase> | null = null;
  const maxTransientFailures = retryDelaysMs.length;

  const readStatus = (): 'ready' | 'degraded' | 'disabled' => {
    return status;
  };

  const isFailed = (): boolean => {
    return status === 'disabled';
  };

  const resetDatabasePromise = (): void => {
    databasePromise = null;
  };

  const openDatabase = (): Promise<IndexedDbDatabase> => {
    if (databasePromise) {
      return databasePromise;
    }

    databasePromise = new Promise<IndexedDbDatabase>((resolve, reject) => {
      try {
        const openRequest = indexedDbFactory.open(dbName, version);
        openRequest.onupgradeneeded = () => {
          const database = openRequest.result;
          if (!database.objectStoreNames.contains(storeName)) {
            database.createObjectStore(storeName);
          }
        };
        openRequest.onsuccess = () => {
          resolve(openRequest.result);
        };
        openRequest.onerror = () => {
          reject(normalizeError(openRequest.error));
        };
      } catch (error) {
        reject(normalizeError(error));
      }
    });

    return databasePromise;
  };

  const markDisabled = (error: unknown): void => {
    status = 'disabled';
    failure = normalizeError(error);
    reconnectScheduled = false;
    valuesByKey.clear();
    missingKeys.clear();
    pendingReadKeys.clear();
    pendingWriteOperationsByKey.clear();
    resetDatabasePromise();
  };

  const handleTransientFailure = (error: unknown): void => {
    status = 'degraded';
    failure = normalizeError(error);
    transientFailureCount += 1;
    resetDatabasePromise();
  };

  const scheduleReconnect = (): void => {
    if (status !== 'degraded' || reconnectInFlight || reconnectScheduled) {
      return;
    }

    reconnectScheduled = true;
    const retryDelay = readRetryDelay({
      attempt: transientFailureCount,
      retryDelaysMs,
    });
    scheduleWithDelay({
      delay: retryDelay,
      callback: () => {
        reconnectScheduled = false;
        void reconnect();
      },
    });
  };

  const handleStorageFailure = (error: unknown): void => {
    const normalizedError = normalizeError(error);
    if (isPermanentIndexedDbError(normalizedError)) {
      markDisabled(normalizedError);
      return;
    }

    if (transientFailureCount + 1 >= maxTransientFailures) {
      markDisabled(normalizedError);
      return;
    }

    handleTransientFailure(normalizedError);
    scheduleReconnect();
  };

  const reconnect = async (): Promise<void> => {
    if (status !== 'degraded' || reconnectInFlight) {
      return;
    }

    reconnectInFlight = true;
    try {
      resetDatabasePromise();
      await openDatabase();
      status = 'ready';
      failure = null;
      transientFailureCount = 0;
      if (pendingReadKeys.size > 0) {
        scheduleReadFlush();
      }
      if (pendingWriteOperationsByKey.size > 0) {
        scheduleWriteFlush();
      }
    } catch (error) {
      handleStorageFailure(error);
    } finally {
      reconnectInFlight = false;
    }
  };

  const flushReads = async (): Promise<void> => {
    if (status !== 'ready') {
      return;
    }

    if (readsInFlight) {
      return;
    }

    if (pendingReadKeys.size === 0) {
      return;
    }

    readsInFlight = true;
    const keys = Array.from(pendingReadKeys).filter((key) => {
      return !pendingWriteOperationsByKey.has(key);
    });
    pendingReadKeys.clear();

    if (keys.length === 0) {
      readsInFlight = false;
      return;
    }

    try {
      const database = await openDatabase();
      const valuesFromDatabaseByKey = await readManyFromDb({
        database,
        keys,
        storeName,
      });
      keys.forEach((key) => {
        if (valuesFromDatabaseByKey.has(key)) {
          const nextValue = valuesFromDatabaseByKey.get(key);
          valuesByKey.set(key, nextValue);
          missingKeys.delete(key);
          return;
        }

        valuesByKey.delete(key);
        missingKeys.add(key);
      });
    } catch (error) {
      keys.forEach((key) => {
        pendingReadKeys.add(key);
      });
      handleStorageFailure(error);
    } finally {
      readsInFlight = false;
      if (status === 'ready' && pendingReadKeys.size > 0) {
        scheduleReadFlush();
      }
    }
  };

  const flushWrites = async (): Promise<void> => {
    if (status !== 'ready') {
      return;
    }

    if (writesInFlight) {
      return;
    }

    if (pendingWriteOperationsByKey.size === 0) {
      return;
    }

    writesInFlight = true;
    const operationsByKey = new Map(pendingWriteOperationsByKey);
    pendingWriteOperationsByKey.clear();

    try {
      const database = await openDatabase();
      await writeManyToDb({
        database,
        operationsByKey,
        storeName,
      });
    } catch (error) {
      operationsByKey.forEach((operation, key) => {
        pendingWriteOperationsByKey.set(key, operation);
      });
      handleStorageFailure(error);
    } finally {
      writesInFlight = false;
      if (status === 'ready' && pendingWriteOperationsByKey.size > 0) {
        scheduleWriteFlush();
      }
    }
  };

  const scheduleReadFlush = (): void => {
    if (status === 'disabled') {
      return;
    }

    if (status === 'degraded') {
      scheduleReconnect();
      return;
    }

    if (readsScheduled) {
      return;
    }

    readsScheduled = true;
    scheduleAsync({
      callback: () => {
        readsScheduled = false;
        void flushReads();
      },
    });
  };

  const scheduleWriteFlush = (): void => {
    if (status === 'disabled') {
      return;
    }

    if (status === 'degraded') {
      scheduleReconnect();
      return;
    }

    if (writesScheduled) {
      return;
    }

    writesScheduled = true;
    scheduleAsync({
      callback: () => {
        writesScheduled = false;
        void flushWrites();
      },
    });
  };

  return {
    getItem: (key) => {
      if (status === 'disabled') {
        return null;
      }

      if (status === 'degraded') {
        scheduleReconnect();
      }

      if (valuesByKey.has(key)) {
        return valuesByKey.get(key) ?? null;
      }

      if (missingKeys.has(key)) {
        return null;
      }

      pendingReadKeys.add(key);
      scheduleReadFlush();
      return null;
    },
    setItem: (key, value) => {
      if (status === 'disabled') {
        return;
      }

      valuesByKey.set(key, value);
      missingKeys.delete(key);
      pendingWriteOperationsByKey.set(key, {
        type: 'set',
        value,
      });
      scheduleWriteFlush();
    },
    removeItem: (key) => {
      if (status === 'disabled') {
        return;
      }

      valuesByKey.delete(key);
      missingKeys.add(key);
      pendingWriteOperationsByKey.set(key, {
        type: 'delete',
      });
      scheduleWriteFlush();
    },
    flush: async () => {
      if (status === 'disabled') {
        return;
      }

      if (status === 'degraded') {
        scheduleReconnect();
        return;
      }

      await Promise.all([flushReads(), flushWrites()]);
    },
    readStatus,
    isFailed,
    readFailure: () => {
      return failure;
    },
  };
};

export const readOrCreateSharedIndexedDbCacheStorage = (): IndexedDbCacheStorage | undefined => {
  if (sharedIndexedDbCacheStorage) {
    return sharedIndexedDbCacheStorage;
  }

  const storage = createIndexedDbCacheStorage();
  if (!storage) {
    return undefined;
  }

  sharedIndexedDbCacheStorage = storage;
  return sharedIndexedDbCacheStorage;
};

export const setSharedIndexedDbCacheStorageForTests = (
  storage: IndexedDbCacheStorage | undefined,
): void => {
  sharedIndexedDbCacheStorage = storage;
};
