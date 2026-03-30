import { describe, expect, it } from 'vitest';

import { createIndexedDbCacheStorage } from './indexedDbCacheStorage.js';

interface MockIndexedDbRequest<TResult> {
  result: TResult;
  error: unknown;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}

interface MockIndexedDbOpenRequest extends MockIndexedDbRequest<MockIndexedDbDatabase> {
  onupgradeneeded: (() => void) | null;
}

interface MockIndexedDbObjectStore {
  get: (key: string) => MockIndexedDbRequest<unknown>;
  put: (value: unknown, key: string) => MockIndexedDbRequest<unknown>;
  delete: (key: string) => MockIndexedDbRequest<unknown>;
}

interface MockIndexedDbTransaction {
  objectStore: (_name: string) => MockIndexedDbObjectStore;
  oncomplete: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
}

interface MockIndexedDbObjectStoreNames {
  contains: (_name: string) => boolean;
}

interface MockIndexedDbDatabase {
  objectStoreNames: MockIndexedDbObjectStoreNames;
  createObjectStore: (_name: string) => MockIndexedDbObjectStore;
  transaction: (_name: string, mode: 'readonly' | 'readwrite') => MockIndexedDbTransaction;
}

interface MockIndexedDbFactory {
  open: (_dbName: string, _version?: number) => MockIndexedDbOpenRequest;
}

interface MockRuntime {
  indexedDB: MockIndexedDbFactory;
}

interface MockIndexedDbState {
  valuesByKey: Map<string, unknown>;
  readTransactions: number;
  writeTransactions: number;
}

const scheduleMicrotask = (callback: () => void): void => {
  Promise.resolve().then(callback);
};

const createRequest = <TResult>(result: TResult): MockIndexedDbRequest<TResult> => {
  const request: MockIndexedDbRequest<TResult> = {
    result,
    error: null,
    onsuccess: null,
    onerror: null,
  };

  scheduleMicrotask(() => {
    request.onsuccess?.();
  });
  return request;
};

const createMockRuntime = (): { runtime: MockRuntime; state: MockIndexedDbState } => {
  const state: MockIndexedDbState = {
    valuesByKey: new Map<string, unknown>(),
    readTransactions: 0,
    writeTransactions: 0,
  };

  const createObjectStore = (): MockIndexedDbObjectStore => {
    return {
      get: (key) => {
        return createRequest(state.valuesByKey.get(key));
      },
      put: (value, key) => {
        state.valuesByKey.set(key, value);
        return createRequest(undefined);
      },
      delete: (key) => {
        state.valuesByKey.delete(key);
        return createRequest(undefined);
      },
    };
  };

  const createTransaction = (mode: 'readonly' | 'readwrite'): MockIndexedDbTransaction => {
    if (mode === 'readonly') {
      state.readTransactions += 1;
    } else {
      state.writeTransactions += 1;
    }

    const transaction: MockIndexedDbTransaction = {
      objectStore: () => {
        return createObjectStore();
      },
      oncomplete: null,
      onerror: null,
      onabort: null,
    };

    scheduleMicrotask(() => {
      transaction.oncomplete?.();
    });

    return transaction;
  };

  const database: MockIndexedDbDatabase = {
    objectStoreNames: {
      contains: () => true,
    },
    createObjectStore: () => {
      return createObjectStore();
    },
    transaction: (_name, mode) => {
      return createTransaction(mode);
    },
  };

  const runtime: MockRuntime = {
    indexedDB: {
      open: () => {
        const openRequest: MockIndexedDbOpenRequest = {
          result: database,
          error: null,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
        };

        scheduleMicrotask(() => {
          openRequest.onsuccess?.();
        });

        return openRequest;
      },
    },
  };

  return {
    runtime,
    state,
  };
};

describe('createIndexedDbCacheStorage()', () => {
  describe('happy', () => {
    it('should batch writes in one transaction per microtask', async () => {
      const { runtime, state } = createMockRuntime();
      const storage = createIndexedDbCacheStorage({
        runtime,
      });

      expect(storage).toBeDefined();
      if (!storage) {
        return;
      }

      storage.setItem('a', { value: 1 });
      storage.setItem('b', { value: 2 });
      await storage.flush();

      expect(state.writeTransactions).toBe(1);
      expect(state.valuesByKey.get('a')).toEqual({ value: 1 });
      expect(state.valuesByKey.get('b')).toEqual({ value: 2 });
    });

    it('should batch reads in one transaction per microtask', async () => {
      const { runtime, state } = createMockRuntime();
      state.valuesByKey.set('a', { value: 1 });
      state.valuesByKey.set('b', { value: 2 });

      const storage = createIndexedDbCacheStorage({
        runtime,
      });

      expect(storage).toBeDefined();
      if (!storage) {
        return;
      }

      expect(storage.getItem('a')).toBeNull();
      expect(storage.getItem('b')).toBeNull();
      await storage.flush();

      expect(state.readTransactions).toBe(1);
      expect(storage.getItem('a')).toEqual({ value: 1 });
      expect(storage.getItem('b')).toEqual({ value: 2 });
    });
  });
});
