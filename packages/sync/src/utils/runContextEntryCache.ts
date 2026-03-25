export interface CreateRunContextEntryCacheInput<TPayload, TEntry> {
  createEntry: (payload: TPayload) => TEntry;
  limit: number;
}

export interface RunContextEntryCache<TPayload, TEntry> {
  getOrCreate: (payload: TPayload) => TEntry;
  clear: () => void;
}

interface ObjectRunContextEntry<TPayload extends object, TEntry> {
  payload: TPayload;
  entry: TEntry;
}

const MIN_PRIMITIVE_CACHE_LIMIT = 1;

const resolvePrimitiveCacheLimit = (limit: number): number => {
  if (!Number.isFinite(limit)) {
    return MIN_PRIMITIVE_CACHE_LIMIT;
  }

  const normalizedLimit = Math.floor(limit);
  if (normalizedLimit < MIN_PRIMITIVE_CACHE_LIMIT) {
    return MIN_PRIMITIVE_CACHE_LIMIT;
  }

  return normalizedLimit;
};

export const createRunContextEntryCache = <TPayload, TEntry>({
  createEntry,
  limit,
}: CreateRunContextEntryCacheInput<TPayload, TEntry>): RunContextEntryCache<TPayload, TEntry> => {
  const primitiveCacheLimit = resolvePrimitiveCacheLimit(limit);
  const primitiveEntries = new Map<unknown, TEntry>();
  const primitiveOrder = new Set<unknown>();
  let latestObjectEntry: ObjectRunContextEntry<object, TEntry> | null = null;
  let previousObjectEntry: ObjectRunContextEntry<object, TEntry> | null = null;

  const getOrCreate = (payload: TPayload): TEntry => {
    if (payload !== null && typeof payload === 'object') {
      if (latestObjectEntry && Object.is(latestObjectEntry.payload, payload)) {
        return latestObjectEntry.entry;
      }

      if (previousObjectEntry && Object.is(previousObjectEntry.payload, payload)) {
        const promotedObjectEntry = previousObjectEntry;
        previousObjectEntry = latestObjectEntry;
        latestObjectEntry = promotedObjectEntry;
        return promotedObjectEntry.entry;
      }

      const createdEntry = createEntry(payload);
      previousObjectEntry = latestObjectEntry;
      latestObjectEntry = {
        payload,
        entry: createdEntry,
      };
      return createdEntry;
    }

    if (primitiveEntries.has(payload)) {
      const existingPrimitiveEntry = primitiveEntries.get(payload) as TEntry;
      primitiveOrder.delete(payload);
      primitiveOrder.add(payload);
      return existingPrimitiveEntry;
    }

    const createdPrimitiveEntry = createEntry(payload);
    primitiveEntries.set(payload, createdPrimitiveEntry);
    primitiveOrder.add(payload);

    if (primitiveEntries.size > primitiveCacheLimit) {
      const oldestPrimitivePayload = primitiveOrder.values().next().value;
      if (oldestPrimitivePayload !== undefined) {
        primitiveOrder.delete(oldestPrimitivePayload);
        primitiveEntries.delete(oldestPrimitivePayload);
      }
    }

    return createdPrimitiveEntry;
  };

  const clear = (): void => {
    primitiveEntries.clear();
    primitiveOrder.clear();
    latestObjectEntry = null;
    previousObjectEntry = null;
  };

  return {
    getOrCreate,
    clear,
  };
};
