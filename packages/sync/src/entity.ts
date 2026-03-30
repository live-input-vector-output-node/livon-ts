import { defaultRuntimeQueue } from './runtimeQueue/index.js';
import {
  resolveEntityReadWriteConfig,
  runEntityWriteStrategy,
  type EntityReadWriteConfig,
  type EntityReadWriteInput,
} from './utils/readWriteStrategy.js';
import {
  resolveAdaptiveReadWriteByCache,
  type AdaptiveReadWriteOperation,
} from './utils/adaptiveReadWrite.js';

export interface UpsertOptions {
  merge?: boolean;
}

export type EntityId = string | number | symbol;
export type DraftMode = 'global' | 'scoped' | 'off';
export type CacheTtl = number | 'infinity';

export interface CacheStorage {
  getItem: (key: string) => unknown | null;
  setItem: (key: string, value: unknown) => void;
  removeItem: (key: string) => void;
  supportsStructuredValues?: boolean;
}

export interface CacheConfig {
  key?: string;
  ttl?: CacheTtl;
  lruMaxEntries?: number;
  storage?: CacheStorage;
}

export interface RegisterEntityUnitInput {
  key: string;
  onChange: () => void;
}

export interface SetEntityUnitMembershipInput<TId extends EntityId> {
  key: string;
  ids: readonly TId[];
}

export interface EntityConfig<
  TInput extends object,
  TId extends EntityId = string,
> {
  key?: string;
  idOf: (input: TInput) => TId;
  ttl?: number;
  destroyDelay?: number;
  draft?: DraftMode;
  cache?: CacheConfig;
  readWrite?: EntityReadWriteInput;
}

export type EntityByIdMap<TInput extends object, TId extends EntityId> = Map<TId, TInput>;

export interface Entity<
  TInput extends object = object,
  TId extends EntityId = string,
> {
  key?: string;
  ttl?: number;
  destroyDelay?: number;
  draft?: DraftMode;
  cache?: CacheConfig;
  readWrite: EntityReadWriteConfig;
  idOf(input: TInput): TId;
  entitiesById: EntityByIdMap<TInput, TId>;
  getDraftById(id: TId): TInput | undefined;
  setDraftById(id: TId, input: TInput): TInput;
  clearDraftById(id: TId): boolean;
  getById(id: TId): TInput | undefined;
  registerUnit(input: RegisterEntityUnitInput): () => void;
  setUnitMembership(input: SetEntityUnitMembershipInput<TId>): void;
  clearUnitMembership(key: string): void;
  upsertOne(input: TInput, options?: UpsertOptions): TInput;
  upsertMany(input: readonly TInput[], options?: UpsertOptions): readonly TInput[];
  deleteOne(id: TId): boolean;
  deleteMany(ids: readonly TId[]): readonly TId[];
}

interface MergeEntityInput<TInput extends object> {
  current: TInput | undefined;
  next: TInput;
  shouldMerge: boolean;
}

interface IsEquivalentEntityInput<TInput extends object> {
  current: TInput;
  next: TInput;
}

const isEquivalentReplace = <TInput extends object>({
  current,
  next,
}: IsEquivalentEntityInput<TInput>): boolean => {
  const currentEntries = Object.entries(current);
  const nextEntries = Object.entries(next);
  if (currentEntries.length !== nextEntries.length) {
    return false;
  }

  const currentValuesByKey = new Map<string, unknown>(currentEntries);
  return nextEntries.every(([key, nextValue]) => {
    if (!currentValuesByKey.has(key)) {
      return false;
    }

    return Object.is(currentValuesByKey.get(key), nextValue);
  });
};

const isEquivalentMerge = <TInput extends object>({
  current,
  next,
}: IsEquivalentEntityInput<TInput>): boolean => {
  const currentValuesByKey = new Map<string, unknown>(Object.entries(current));
  return Object.entries(next).every(([key, nextValue]) => {
    if (!currentValuesByKey.has(key)) {
      return false;
    }

    return Object.is(currentValuesByKey.get(key), nextValue);
  });
};

const mergeEntity = <TInput extends object>({
  current,
  next,
  shouldMerge,
}: MergeEntityInput<TInput>): TInput => {
  if (!current) {
    return next;
  }

  if (!shouldMerge) {
    if (isEquivalentReplace({ current, next })) {
      return current;
    }

    return next;
  }

  if (isEquivalentMerge({ current, next })) {
    return current;
  }

  return {
    ...current,
    ...next,
  };
};

interface EntityUnitState<TId extends EntityId> {
  onChange: () => void;
  membershipIds: Set<TId>;
}

interface EntityUnitKeyInput<TId extends EntityId> {
  id: TId;
  key: string;
}

interface TimeoutRuntime {
  setTimeout: (callback: () => void, delay: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

let nextEntityQueueId = 0;
const NOTIFY_BATCH_THRESHOLD = 32;

const hasTimeoutRuntime = (value: unknown): value is TimeoutRuntime => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return 'setTimeout' in value
    && 'clearTimeout' in value
    && typeof value.setTimeout === 'function'
    && typeof value.clearTimeout === 'function';
};

const resolveTimeoutRuntime = (): TimeoutRuntime | undefined => {
  const runtime = globalThis;
  if (!hasTimeoutRuntime(runtime)) {
    return undefined;
  }

  return runtime;
};

const resolveOrphanRetentionTtl = ({
  cache,
  ttl,
}: {
  cache?: CacheConfig;
  ttl?: number;
}): CacheTtl => {
  if (cache?.ttl !== undefined) {
    return cache.ttl;
  }

  if (ttl !== undefined) {
    return ttl;
  }

  return 0;
};

interface ResolveEntityOperationReadWriteStrategyInput {
  adaptiveEnabled: boolean;
  readWriteConfig: EntityReadWriteConfig;
  hasExplicitBatchReadWrite: boolean;
  hasExplicitSubviewReadWrite: boolean;
  readWrite?: EntityReadWriteInput;
  cacheEnabled: boolean;
  lruEnabled: boolean;
  operation: AdaptiveReadWriteOperation;
}

type EntityReadWriteStrategies = Record<AdaptiveReadWriteOperation, EntityReadWriteConfig>;

const resolveEntityOperationReadWriteStrategy = ({
  adaptiveEnabled,
  readWriteConfig,
  hasExplicitBatchReadWrite,
  hasExplicitSubviewReadWrite,
  readWrite,
  cacheEnabled,
  lruEnabled,
  operation,
}: ResolveEntityOperationReadWriteStrategyInput): EntityReadWriteConfig => {
  if (!adaptiveEnabled) {
    return readWriteConfig;
  }

  const recommendedStrategy = resolveAdaptiveReadWriteByCache({
    cacheEnabled,
    lruEnabled,
    operation,
    fallback: readWriteConfig,
  });

  return {
    batch: hasExplicitBatchReadWrite
      ? (readWrite?.batch ?? recommendedStrategy.batch)
      : recommendedStrategy.batch,
    subview: hasExplicitSubviewReadWrite
      ? (readWrite?.subview ?? recommendedStrategy.subview)
      : recommendedStrategy.subview,
  };
};

interface CreateEntityReadWriteStrategiesInput {
  readWriteConfig: EntityReadWriteConfig;
  readWrite?: EntityReadWriteInput;
  cache?: CacheConfig;
}

const createEntityReadWriteStrategies = ({
  readWriteConfig,
  readWrite,
  cache,
}: CreateEntityReadWriteStrategiesInput): EntityReadWriteStrategies => {
  const adaptiveEnabled = readWrite?.adaptive === true;
  const hasExplicitBatchReadWrite = readWrite?.batch !== undefined;
  const hasExplicitSubviewReadWrite = readWrite?.subview !== undefined;
  const cacheEnabled = Boolean(cache);
  const lruEnabled = typeof cache?.lruMaxEntries === 'number'
    && Number.isFinite(cache.lruMaxEntries)
    && cache.lruMaxEntries > 0;

  return {
    readOne: resolveEntityOperationReadWriteStrategy({
      adaptiveEnabled,
      readWriteConfig,
      hasExplicitBatchReadWrite,
      hasExplicitSubviewReadWrite,
      readWrite,
      cacheEnabled,
      lruEnabled,
      operation: 'readOne',
    }),
    readMany: resolveEntityOperationReadWriteStrategy({
      adaptiveEnabled,
      readWriteConfig,
      hasExplicitBatchReadWrite,
      hasExplicitSubviewReadWrite,
      readWrite,
      cacheEnabled,
      lruEnabled,
      operation: 'readMany',
    }),
    updateOne: resolveEntityOperationReadWriteStrategy({
      adaptiveEnabled,
      readWriteConfig,
      hasExplicitBatchReadWrite,
      hasExplicitSubviewReadWrite,
      readWrite,
      cacheEnabled,
      lruEnabled,
      operation: 'updateOne',
    }),
    updateMany: resolveEntityOperationReadWriteStrategy({
      adaptiveEnabled,
      readWriteConfig,
      hasExplicitBatchReadWrite,
      hasExplicitSubviewReadWrite,
      readWrite,
      cacheEnabled,
      lruEnabled,
      operation: 'updateMany',
    }),
    setOne: resolveEntityOperationReadWriteStrategy({
      adaptiveEnabled,
      readWriteConfig,
      hasExplicitBatchReadWrite,
      hasExplicitSubviewReadWrite,
      readWrite,
      cacheEnabled,
      lruEnabled,
      operation: 'setOne',
    }),
    setMany: resolveEntityOperationReadWriteStrategy({
      adaptiveEnabled,
      readWriteConfig,
      hasExplicitBatchReadWrite,
      hasExplicitSubviewReadWrite,
      readWrite,
      cacheEnabled,
      lruEnabled,
      operation: 'setMany',
    }),
  };
};

export const entity = <
  TInput extends object,
  TId extends EntityId = string,
>({
  key,
  idOf,
  ttl,
  destroyDelay,
  draft,
  cache,
  readWrite,
}: EntityConfig<TInput, TId>): Entity<TInput, TId> => {
  const entitiesById: EntityByIdMap<TInput, TId> = new Map<TId, TInput>();
  const draftsById: EntityByIdMap<TInput, TId> = new Map<TId, TInput>();
  const unitStateByKey = new Map<string, EntityUnitState<TId>>();
  const unitKeysById = new Map<TId, Set<string>>();
  const dirtyUnitKeys = new Set<string>();
  const orphanExpiresAtById = new Map<TId, number>();
  let orphanSweepTimeout: unknown | null = null;
  let orphanNextSweepAt: number | null = null;
  nextEntityQueueId += 1;
  const dirtyUnitsQueueKey = `entity-dirty:${nextEntityQueueId}`;
  const readWriteConfig = resolveEntityReadWriteConfig(readWrite);
  const readWriteStrategies = createEntityReadWriteStrategies({
    readWriteConfig,
    readWrite,
    cache,
  });
  const defaultReadWriteStrategy = readWriteStrategies.readMany;
  const timeoutRuntime = resolveTimeoutRuntime();
  const orphanRetentionTtl = resolveOrphanRetentionTtl({
    cache,
    ttl,
  });

  const hasEntitySubscribers = (id: TId): boolean => {
    const keys = unitKeysById.get(id);
    return Boolean(keys && keys.size > 0);
  };

  const clearActiveOrphanSweepTimeout = (): void => {
    if (orphanSweepTimeout !== null && timeoutRuntime) {
      timeoutRuntime.clearTimeout(orphanSweepTimeout);
    }

    orphanSweepTimeout = null;
    orphanNextSweepAt = null;
  };

  const resolveNextOrphanSweepAt = (): number | null => {
    let nextSweepAt: number | null = null;
    orphanExpiresAtById.forEach((expiresAt) => {
      if (nextSweepAt === null || expiresAt < nextSweepAt) {
        nextSweepAt = expiresAt;
      }
    });

    return nextSweepAt;
  };

  const scheduleOrphanSweepAt = (nextSweepAt: number): void => {
    if (!timeoutRuntime) {
      return;
    }

    if (
      orphanSweepTimeout !== null
      && orphanNextSweepAt !== null
      && orphanNextSweepAt <= nextSweepAt
    ) {
      return;
    }

    clearActiveOrphanSweepTimeout();
    orphanNextSweepAt = nextSweepAt;
    const delay = Math.max(0, nextSweepAt - Date.now());
    orphanSweepTimeout = timeoutRuntime.setTimeout(() => {
      orphanSweepTimeout = null;
      orphanNextSweepAt = null;
      sweepExpiredOrphans();
    }, delay);
  };

  const syncOrphanSweepTimeoutByScan = (): void => {
    const nextSweepAt = resolveNextOrphanSweepAt();
    if (nextSweepAt === null) {
      clearActiveOrphanSweepTimeout();
      return;
    }

    scheduleOrphanSweepAt(nextSweepAt);
  };

  const clearOrphanCleanupSchedule = (id: TId): number | undefined => {
    const expiresAt = orphanExpiresAtById.get(id);
    if (expiresAt === undefined) {
      return undefined;
    }

    orphanExpiresAtById.delete(id);
    return expiresAt;
  };

  const removeOrphanEntityById = (id: TId): void => {
    if (hasEntitySubscribers(id)) {
      clearOrphanCleanupSchedule(id);
      return;
    }

    clearOrphanCleanupSchedule(id);
    entitiesById.delete(id);
    draftsById.delete(id);
  };

  const sweepExpiredOrphans = (): void => {
    if (orphanExpiresAtById.size === 0) {
      clearActiveOrphanSweepTimeout();
      return;
    }

    const now = Date.now();
    let hasExpired = false;
    orphanExpiresAtById.forEach((expiresAt, id) => {
      if (expiresAt > now) {
        return;
      }

      hasExpired = true;
      removeOrphanEntityById(id);
    });

    if (hasExpired) {
      syncOrphanSweepTimeoutByScan();
      return;
    }

    if (orphanSweepTimeout === null) {
      syncOrphanSweepTimeoutByScan();
    }
  };

  const scheduleOrphanCleanup = (id: TId): void => {
    if (hasEntitySubscribers(id)) {
      const removedExpiresAt = clearOrphanCleanupSchedule(id);
      if (removedExpiresAt !== undefined && removedExpiresAt === orphanNextSweepAt) {
        syncOrphanSweepTimeoutByScan();
      }
      return;
    }

    if (orphanRetentionTtl === 'infinity') {
      const removedExpiresAt = clearOrphanCleanupSchedule(id);
      if (removedExpiresAt !== undefined && removedExpiresAt === orphanNextSweepAt) {
        syncOrphanSweepTimeoutByScan();
      }
      return;
    }

    if (orphanRetentionTtl > 0) {
      const expiresAt = Date.now() + orphanRetentionTtl;
      orphanExpiresAtById.set(id, expiresAt);
      scheduleOrphanSweepAt(expiresAt);
      return;
    }

    removeOrphanEntityById(id);
    if (orphanSweepTimeout !== null) {
      syncOrphanSweepTimeoutByScan();
    }
  };

  const getById = (id: TId): TInput | undefined => {
    sweepExpiredOrphans();
    return entitiesById.get(id);
  };

  const getDraftById = (id: TId): TInput | undefined => {
    sweepExpiredOrphans();
    return draftsById.get(id);
  };

  const removeUnitKeyFromId = ({
    id,
    key,
  }: EntityUnitKeyInput<TId>): void => {
    sweepExpiredOrphans();
    const keys = unitKeysById.get(id);

    if (!keys) {
      return;
    }

    keys.delete(key);
    if (keys.size === 0) {
      unitKeysById.delete(id);
      scheduleOrphanCleanup(id);
    }
  };

  const addUnitKeyToId = ({
    id,
    key,
  }: EntityUnitKeyInput<TId>): void => {
    sweepExpiredOrphans();
    const removedExpiresAt = clearOrphanCleanupSchedule(id);
    if (removedExpiresAt !== undefined && removedExpiresAt === orphanNextSweepAt) {
      syncOrphanSweepTimeoutByScan();
    }

    const existingKeys = unitKeysById.get(id);
    if (existingKeys) {
      existingKeys.add(key);
      return;
    }

    unitKeysById.set(id, new Set<string>([key]));
  };

  const clearUnitMembership = (key: string): void => {
    const unitState = unitStateByKey.get(key);
    if (!unitState) {
      return;
    }

    unitState.membershipIds.forEach((id) => {
      removeUnitKeyFromId({ id, key });
    });
    unitState.membershipIds.clear();
  };

  const unregisterUnit = (key: string): void => {
    clearUnitMembership(key);
    unitStateByKey.delete(key);
  };

  const registerUnit = ({
    key,
    onChange,
  }: RegisterEntityUnitInput): (() => void) => {
    sweepExpiredOrphans();
    unregisterUnit(key);
    unitStateByKey.set(key, {
      onChange,
      membershipIds: new Set<TId>(),
    });

    return () => {
      unregisterUnit(key);
    };
  };

  const setUnitMembership = ({
    key,
    ids,
  }: SetEntityUnitMembershipInput<TId>): void => {
    sweepExpiredOrphans();
    const unitState = unitStateByKey.get(key);
    if (!unitState) {
      return;
    }

    const currentMembershipIds = unitState.membershipIds;
    if (ids.length === 1) {
      const [nextSingleMembershipId] = ids;
      if (nextSingleMembershipId === undefined) {
        return;
      }

      if (currentMembershipIds.size === 1) {
        const currentSingleMembershipId = currentMembershipIds.values().next().value;
        if (currentSingleMembershipId === nextSingleMembershipId) {
          return;
        }

        if (currentSingleMembershipId !== undefined) {
          removeUnitKeyFromId({ id: currentSingleMembershipId, key });
        }

        currentMembershipIds.clear();
        currentMembershipIds.add(nextSingleMembershipId);
        addUnitKeyToId({ id: nextSingleMembershipId, key });
        return;
      }

      currentMembershipIds.forEach((id) => {
        if (id === nextSingleMembershipId) {
          return;
        }

        removeUnitKeyFromId({ id, key });
      });
      const hasNextSingleMembershipId = currentMembershipIds.has(nextSingleMembershipId);
      currentMembershipIds.clear();
      currentMembershipIds.add(nextSingleMembershipId);
      if (!hasNextSingleMembershipId) {
        addUnitKeyToId({ id: nextSingleMembershipId, key });
      }
      return;
    }

    if (currentMembershipIds.size === ids.length) {
      const hasDifferentId = ids.some((id) => !currentMembershipIds.has(id));
      if (!hasDifferentId) {
        return;
      }
    }

    const nextMembershipIds = new Set<TId>(ids);

    currentMembershipIds.forEach((id) => {
      if (!nextMembershipIds.has(id)) {
        removeUnitKeyFromId({ id, key });
      }
    });

    nextMembershipIds.forEach((id) => {
      if (!currentMembershipIds.has(id)) {
        addUnitKeyToId({ id, key });
      }
    });

    unitState.membershipIds = nextMembershipIds;
  };

  const notifyUnitsById = (id: TId): void => {
    const unitKeys = unitKeysById.get(id);

    if (!unitKeys) {
      return;
    }

    unitKeys.forEach((key) => {
      const unitState = unitStateByKey.get(key);
      unitState?.onChange();
    });
  };

  const notifyUnitByKey = (key: string): void => {
    const unitState = unitStateByKey.get(key);
    unitState?.onChange();
  };

  const setDraftById = (id: TId, input: TInput): TInput => {
    draftsById.set(id, input);
    notifyUnitsById(id);

    return input;
  };

  const clearDraftById = (id: TId): boolean => {
    const existed = draftsById.delete(id);

    if (!existed) {
      return false;
    }

    notifyUnitsById(id);

    return true;
  };

  const flushDirtyUnits = (): void => {
    const keys = Array.from(dirtyUnitKeys);
    dirtyUnitKeys.clear();

    keys.forEach((key) => {
      const unitState = unitStateByKey.get(key);
      unitState?.onChange();
    });
  };

  const scheduleDirtyUnitsFlush = (): void => {
    defaultRuntimeQueue.enqueue({
      channel: 'state',
      key: dirtyUnitsQueueKey,
      run: flushDirtyUnits,
    });
  };

  const queueUnitsByKeys = (keys: Set<string>): void => {
    if (keys.size === 0) {
      return;
    }

    keys.forEach((key) => {
      dirtyUnitKeys.add(key);
    });

    scheduleDirtyUnitsFlush();
  };

  const queueUnitsByIds = (ids: Set<TId>): void => {
    if (unitKeysById.size === 0) {
      return;
    }

    const keys = new Set<string>();
    ids.forEach((id) => {
      const unitKeys = unitKeysById.get(id);
      if (!unitKeys) {
        return;
      }

      unitKeys.forEach((key) => {
        keys.add(key);
      });
    });

    queueUnitsByKeys(keys);
  };

  const queueUnitsById = (id: TId): void => {
    const unitKeys = unitKeysById.get(id);
    if (!unitKeys || unitKeys.size === 0) {
      return;
    }

    queueUnitsByKeys(unitKeys);
  };

  const upsertOne = (input: TInput, options?: UpsertOptions): TInput => {
    sweepExpiredOrphans();
    const id = idOf(input);
    const currentEntity = entitiesById.get(id);
    const mergedInput = mergeEntity({
      current: currentEntity,
      next: input,
      shouldMerge: Boolean(options?.merge),
    });

    if (Object.is(currentEntity, mergedInput)) {
      return mergedInput;
    }

    entitiesById.set(id, mergedInput);
    runEntityWriteStrategy({
      strategy: readWriteStrategies.updateOne,
      changedIdCount: 1,
      batchThreshold: NOTIFY_BATCH_THRESHOLD,
      runImmediate: () => {
        notifyUnitsById(id);
      },
      runBatched: () => {
        queueUnitsById(id);
      },
    });

    return mergedInput;
  };

  const upsertMany = (input: readonly TInput[], options?: UpsertOptions): readonly TInput[] => {
    sweepExpiredOrphans();
    const changedIds = new Set<TId>();
    let hasDuplicates = false;
    const mergedValues: TInput[] = [];

    input.forEach((entry) => {
      const id = idOf(entry);
      const currentEntity = entitiesById.get(id);
      const mergedInput = mergeEntity({
        current: currentEntity,
        next: entry,
        shouldMerge: Boolean(options?.merge),
      });

      const changed = !Object.is(currentEntity, mergedInput);
      if (changed) {
        entitiesById.set(id, mergedInput);
        const changedIdCountBefore = changedIds.size;
        changedIds.add(id);
        if (changedIds.size === changedIdCountBefore) {
          hasDuplicates = true;
        }
      }

      mergedValues.push(mergedInput);
    });

    runEntityWriteStrategy({
      strategy: readWriteStrategies.updateMany,
      changedIdCount: changedIds.size,
      hasDuplicates,
      batchThreshold: NOTIFY_BATCH_THRESHOLD,
      runImmediate: () => {
        changedIds.forEach((id) => {
          notifyUnitsById(id);
        });
      },
      runBatched: () => {
        queueUnitsByIds(changedIds);
      },
    });

    return mergedValues;
  };

  const deleteOne = (id: TId): boolean => {
    sweepExpiredOrphans();
    const removedExpiresAt = clearOrphanCleanupSchedule(id);
    const existed = entitiesById.delete(id);
    draftsById.delete(id);
    if (removedExpiresAt !== undefined && removedExpiresAt === orphanNextSweepAt) {
      syncOrphanSweepTimeoutByScan();
    }

    if (!existed) {
      return false;
    }

    const affectedKeySnapshot = new Set<string>(unitKeysById.get(id) ?? []);

    affectedKeySnapshot.forEach((key) => {
      const unitState = unitStateByKey.get(key);
      if (!unitState) {
        return;
      }

      unitState.membershipIds.delete(id);
    });

    unitKeysById.delete(id);

    runEntityWriteStrategy({
      strategy: readWriteStrategies.updateOne,
      changedIdCount: 1,
      affectedKeyCount: affectedKeySnapshot.size,
      batchThreshold: NOTIFY_BATCH_THRESHOLD,
      runImmediate: () => {
        affectedKeySnapshot.forEach((key) => {
          notifyUnitByKey(key);
        });
      },
      runBatched: () => {
        queueUnitsByKeys(affectedKeySnapshot);
      },
    });

    return true;
  };

  const deleteMany = (ids: readonly TId[]): readonly TId[] => {
    sweepExpiredOrphans();
    const removedIds: TId[] = [];
    const affectedKeys = new Set<string>();
    let removedNextScheduledOrphan = false;

    ids.forEach((id) => {
      const removedExpiresAt = clearOrphanCleanupSchedule(id);
      if (removedExpiresAt !== undefined && removedExpiresAt === orphanNextSweepAt) {
        removedNextScheduledOrphan = true;
      }
      const existed = entitiesById.delete(id);
      draftsById.delete(id);
      if (!existed) {
        return;
      }

      removedIds.push(id);
      const unitKeys = unitKeysById.get(id);
      if (!unitKeys) {
        return;
      }

      unitKeys.forEach((key) => {
        affectedKeys.add(key);
        const unitState = unitStateByKey.get(key);
        if (!unitState) {
          return;
        }

        unitState.membershipIds.delete(id);
      });

      unitKeysById.delete(id);
    });

    if (removedNextScheduledOrphan) {
      syncOrphanSweepTimeoutByScan();
    }

    runEntityWriteStrategy({
      strategy: readWriteStrategies.updateMany,
      changedIdCount: removedIds.length,
      affectedKeyCount: affectedKeys.size,
      batchThreshold: NOTIFY_BATCH_THRESHOLD,
      runImmediate: () => {
        affectedKeys.forEach((key) => {
          notifyUnitByKey(key);
        });
      },
      runBatched: () => {
        queueUnitsByKeys(affectedKeys);
      },
    });

    return removedIds;
  };

  return {
    key,
    ttl,
    destroyDelay,
    draft,
    cache,
    readWrite: defaultReadWriteStrategy,
    idOf,
    entitiesById,
    getDraftById,
    setDraftById,
    clearDraftById,
    getById,
    registerUnit,
    setUnitMembership,
    clearUnitMembership,
    upsertOne,
    upsertMany,
    deleteOne,
    deleteMany,
  };
};
