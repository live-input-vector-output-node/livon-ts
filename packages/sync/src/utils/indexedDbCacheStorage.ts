import { type CacheStorage } from '../entity.js';
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
}

export interface IndexedDbCacheStorage extends CacheStorage {
  supportsStructuredValues: true;
  flush: () => Promise<void>;
}

const DEFAULT_DB_NAME = 'livon-sync-cache';
const DEFAULT_STORE_NAME = 'source-cache';
const DEFAULT_DB_VERSION = 1;

let sharedIndexedDbCacheStorage: IndexedDbCacheStorage | undefined;

const isIndexedDbFactory = (value: unknown): value is IndexedDbFactory => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return 'open' in value && typeof value.open === 'function';
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

  const openDatabase = (() => {
    let databasePromise: Promise<IndexedDbDatabase> | null = null;

    return (): Promise<IndexedDbDatabase> => {
      if (databasePromise) {
        return databasePromise;
      }

      databasePromise = new Promise<IndexedDbDatabase>((resolve, reject) => {
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
          reject(openRequest.error);
        };
      });

      return databasePromise;
    };
  })();

  const flushReads = async (): Promise<void> => {
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
    } catch {
      // Keep L1-only mode when IndexedDB access fails.
    } finally {
      readsInFlight = false;
      if (pendingReadKeys.size > 0) {
        scheduleReadFlush();
      }
    }
  };

  const flushWrites = async (): Promise<void> => {
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
    } catch {
      // Keep L1-only mode when IndexedDB access fails.
    } finally {
      writesInFlight = false;
      if (pendingWriteOperationsByKey.size > 0) {
        scheduleWriteFlush();
      }
    }
  };

  const scheduleReadFlush = (): void => {
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
    supportsStructuredValues: true,
    getItem: (key) => {
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
      valuesByKey.set(key, value);
      missingKeys.delete(key);
      pendingWriteOperationsByKey.set(key, {
        type: 'set',
        value,
      });
      scheduleWriteFlush();
    },
    removeItem: (key) => {
      valuesByKey.delete(key);
      missingKeys.add(key);
      pendingWriteOperationsByKey.set(key, {
        type: 'delete',
      });
      scheduleWriteFlush();
    },
    flush: async () => {
      await Promise.all([flushReads(), flushWrites()]);
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
