export interface CreateIdentityUnitCacheInput {
  maxEntries?: number;
}

export interface IdentityUnitCache<TValue> {
  get: (key: string) => TValue | undefined;
  set: (key: string, value: TValue) => void;
  delete: (key: string) => void;
  clear: () => void;
  size: () => number;
}

const DEFAULT_IDENTITY_UNIT_CACHE_MAX_ENTRIES = 512;

const resolveMaxEntries = (
  value: number | undefined,
): number => {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_IDENTITY_UNIT_CACHE_MAX_ENTRIES;
  }

  const normalizedValue = Math.floor(value);
  if (normalizedValue < 1) {
    return DEFAULT_IDENTITY_UNIT_CACHE_MAX_ENTRIES;
  }

  return normalizedValue;
};

export const createIdentityUnitCache = <TValue>({
  maxEntries,
}: CreateIdentityUnitCacheInput = {}): IdentityUnitCache<TValue> => {
  const resolvedMaxEntries = resolveMaxEntries(maxEntries);
  const valueByKey = new Map<string, TValue>();
  const keyOrder = new Map<string, true>();

  const touchKey = (key: string): void => {
    if (!keyOrder.has(key)) {
      return;
    }

    keyOrder.delete(key);
    keyOrder.set(key, true);
  };

  const evictOldestKeyIfNeeded = (): void => {
    if (valueByKey.size <= resolvedMaxEntries) {
      return;
    }

    const oldestKeyCandidate = keyOrder.keys().next().value;
    if (typeof oldestKeyCandidate !== 'string') {
      return;
    }

    keyOrder.delete(oldestKeyCandidate);
    valueByKey.delete(oldestKeyCandidate);
  };

  const get = (key: string): TValue | undefined => {
    const existingValue = valueByKey.get(key);
    if (existingValue === undefined) {
      return undefined;
    }

    touchKey(key);
    return existingValue;
  };

  const set = (key: string, value: TValue): void => {
    valueByKey.set(key, value);
    touchKey(key);
    if (!keyOrder.has(key)) {
      keyOrder.set(key, true);
    }
    evictOldestKeyIfNeeded();
  };

  const deleteValue = (key: string): void => {
    keyOrder.delete(key);
    valueByKey.delete(key);
  };

  const clear = (): void => {
    keyOrder.clear();
    valueByKey.clear();
  };

  return {
    get,
    set,
    delete: deleteValue,
    clear,
    size: () => valueByKey.size,
  };
};
