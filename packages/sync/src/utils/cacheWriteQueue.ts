import { type CacheStorage } from '../entity.js';
import { defaultRuntimeQueue, type RuntimeQueue } from '../runtimeQueue/index.js';

interface BuildCacheValue {
  (): unknown;
}

interface CacheSetOperation {
  type: 'set';
  value: unknown | BuildCacheValue;
}

interface CacheRemoveOperation {
  type: 'remove';
}

type CacheOperation =
  | CacheSetOperation
  | CacheRemoveOperation;

export interface CacheWriteQueue {
  enqueueSet: (key: string, value: unknown | BuildCacheValue) => void;
  enqueueRemove: (key: string) => void;
  flush: () => void;
}

export interface CreateCacheWriteQueueInput {
  storage: CacheStorage;
  batchSize?: number;
  runtimeQueue?: RuntimeQueue;
  queueKey?: string;
}

interface ReadOrCreateSharedCacheWriteQueueInput {
  storage: CacheStorage;
}

const DEFAULT_BATCH_SIZE = 50;
let nextCacheWriteQueueId = 0;
const sharedCacheWriteQueueByStorage = new WeakMap<CacheStorage, CacheWriteQueue>();

export const createCacheWriteQueue = ({
  storage,
  batchSize = DEFAULT_BATCH_SIZE,
  runtimeQueue = defaultRuntimeQueue,
  queueKey,
}: CreateCacheWriteQueueInput): CacheWriteQueue => {
  const operationsByKey = new Map<string, CacheOperation>();
  nextCacheWriteQueueId += 1;
  const flushQueueKey = queueKey ?? `cache-write:${nextCacheWriteQueueId}`;

  const runBatch = (): void => {
    const entries = Array.from(operationsByKey.entries());
    const currentBatch = entries.slice(0, batchSize);

    currentBatch.forEach(([key]) => {
      operationsByKey.delete(key);
    });

    currentBatch.forEach(([key, operation]) => {
      try {
        if (operation.type === 'set') {
          const value = typeof operation.value === 'function'
            ? operation.value()
            : operation.value;
          storage.setItem(key, value);
          return;
        }

        storage.removeItem(key);
      } catch {
        return;
      }
    });
  };

  const scheduleFlush = (): void => {
    runtimeQueue.enqueue({
      channel: 'storage',
      key: flushQueueKey,
      run: () => {
        runBatch();
        if (operationsByKey.size > 0) {
          scheduleFlush();
        }
      },
    });
  };

  const enqueueSet = (key: string, value: unknown | BuildCacheValue): void => {
    operationsByKey.set(key, {
      type: 'set',
      value,
    });
    scheduleFlush();
  };

  const enqueueRemove = (key: string): void => {
    operationsByKey.set(key, {
      type: 'remove',
    });
    scheduleFlush();
  };

  const flushRemaining = (): void => {
    if (operationsByKey.size === 0) {
      return;
    }

    runBatch();
    flushRemaining();
  };

  const flush = (): void => {
    flushRemaining();
  };

  return {
    enqueueSet,
    enqueueRemove,
    flush,
  };
};

export const readOrCreateSharedCacheWriteQueue = ({
  storage,
}: ReadOrCreateSharedCacheWriteQueueInput): CacheWriteQueue => {
  const existingQueue = sharedCacheWriteQueueByStorage.get(storage);
  if (existingQueue) {
    return existingQueue;
  }

  const nextQueue = createCacheWriteQueue({ storage });
  sharedCacheWriteQueueByStorage.set(storage, nextQueue);
  return nextQueue;
};
