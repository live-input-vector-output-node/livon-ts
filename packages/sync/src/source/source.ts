import { type DraftMode, type EntityId } from '../entity.js';
import {
  applyEntityRunResult,
  clearEntityMembership,
  createEntityRunContextMethods,
  createRunContextEntryCache,
  readOrCreateSharedCacheWriteQueue,
  createSerializedKeyCache,
  createUnitSnapshot,
  notifyEffectListeners,
  resolveInput,
  resolveValue,
  scheduleAsync,
  setManyEntityMembership,
  setOneEntityMembership,
  serializeKey,
  type EffectListener,
  type UnitRunPrevious,
  type UnitDataEntity,
  type ValueUpdater,
} from '../utils/index.js';

import {
  getModeValue,
  hasStringKeysArray,
  invokeSourceCleanup,
  isCacheRecordExpired,
  isSourceCleanup,
  readSourceCacheRecord,
  resolveCacheLruMaxEntries,
  resolveCacheKey,
  resolveCacheStorage,
  resolveCacheTtl,
  serializeSourceCacheRecord,
  shouldUseCache,
} from './helpers.js';
import type {
  ReadEntityValueById,
  Source,
  SourceConfig,
  SourceContext,
  SourceRunConfig,
  SourceRun,
  SourceRunInput,
  SourceRunContext,
  SourceRunContextEntry,
  SourceRunGate,
  SourceSetAction,
  SourceUnit,
  SourceUnitByKeyMap,
  SourceUnitInternal,
} from './types.js';

const DEFAULT_DESTROY_DELAY = 250;
const DEFAULT_DRAFT_MODE: DraftMode = 'global';
const RUN_CONTEXT_CACHE_LIMIT = 32;
const SOURCE_CACHE_LRU_STORAGE_KEY_SUFFIX = '__lru__';
const SOURCE_CACHE_ENTITY_KEY_ERROR = 'entity.key is required when source cache is enabled.';
const SOURCE_CACHE_SOURCE_KEY_ERROR = 'source.key is required when source cache is enabled.';
const SOURCE_RUN_RESULT_ERROR = 'source.run() must return void or a cleanup function.';
const resolveRunAsVoid = (): void => undefined;

interface ReadUnitCacheLruCandidatesInput {
  excludeUnitCacheKey: string;
}

interface HydrateFromUnitCacheKeyInput {
  unitCacheKey: string;
  cacheStateOnHit: 'hit' | 'stale';
}

interface ResolveSourceCacheNamespaceKeyInput<
  TMode extends 'one' | 'many',
> {
  entityKey: string;
  sourceKey: string;
  mode: TMode;
}

const createInitialSourceContext = (
  hasCacheStorage: boolean,
): SourceContext => {
  return {
    cacheState: hasCacheStorage ? 'miss' : 'disabled',
    error: null,
  };
};

const isSourceSetAction = <
  TPayload,
  TData,
  TMeta,
>(
  input: unknown,
): input is SourceSetAction<TPayload, TData, TMeta> => {
  return typeof input === 'function';
};

const isNonEmptyString = (input: unknown): input is string => {
  return typeof input === 'string' && input.trim().length > 0;
};

const resolveSourceCacheNamespaceKey = <
  TMode extends 'one' | 'many',
>({
  entityKey,
  sourceKey,
  mode,
}: ResolveSourceCacheNamespaceKeyInput<TMode>): string => {
  return serializeKey({
    entityKey,
    sourceKey,
    mode,
  });
};

export const source = <
  TIdentity extends object | undefined,
  TPayload = unknown,
  TData = unknown,
  TMeta = unknown,
>({
  key: sourceKey,
  entity,
  ttl = entity.ttl ?? 0,
  draft = entity.draft ?? DEFAULT_DRAFT_MODE,
  cache,
  destroyDelay = entity.destroyDelay ?? DEFAULT_DESTROY_DELAY,
  run,
  defaultValue,
}: SourceConfig<TIdentity, TPayload, TData, TMeta>,
): Source<TIdentity, TPayload, TData, TMeta> => {
  const cacheTtl = resolveCacheTtl({
    sourceCache: cache,
    entityCache: entity.cache,
  });
  const cacheLruMaxEntries = resolveCacheLruMaxEntries({
    sourceCache: cache,
    entityCache: entity.cache,
  });
  const cacheStorage = resolveCacheStorage();
  const sourceMode: 'one' | 'many' = Array.isArray(defaultValue ?? null) ? 'many' : 'one';
  const normalizedEntityKey = isNonEmptyString(entity.key)
    ? entity.key
    : (isNonEmptyString(entity.cache?.key) ? entity.cache.key : '');
  const normalizedSourceKey = isNonEmptyString(sourceKey)
    ? sourceKey
    : (isNonEmptyString(cache?.key) ? cache.key : '');
  const hasEnabledCache = Boolean(
    cacheStorage
    && (cacheTtl === 'infinity' || cacheTtl > 0),
  );
  if (hasEnabledCache && normalizedEntityKey.length === 0) {
    throw new Error(SOURCE_CACHE_ENTITY_KEY_ERROR);
  }
  if (hasEnabledCache && normalizedSourceKey.length === 0) {
    throw new Error(SOURCE_CACHE_SOURCE_KEY_ERROR);
  }
  const sourceCacheNamespaceKey = resolveSourceCacheNamespaceKey({
    entityKey: normalizedEntityKey,
    sourceKey: normalizedSourceKey,
    mode: sourceMode,
  });
  const cacheWriteQueue = cacheStorage
    ? readOrCreateSharedCacheWriteQueue({ storage: cacheStorage })
    : undefined;
  const cacheKeyPrefix = resolveCacheKey({
    sourceKey: sourceCacheNamespaceKey,
  });

  const unitsByKey: SourceUnitByKeyMap<TIdentity, TPayload, TData, TMeta> =
    new Map<string, SourceUnitInternal<TIdentity, TPayload, TData, TMeta>>();
  const unitKeyCache = createSerializedKeyCache({
    mode: 'scoped-unit',
  });

  const readEntityValueById: ReadEntityValueById<EntityId, UnitDataEntity<TData>> = (id) => {
    if (draft === 'off') {
      return entity.getById(id);
    }

    if (draft === 'global') {
      const globalDraft = entity.getDraftById(id);
      if (globalDraft) {
        return globalDraft;
      }

      return entity.getById(id);
    }

    return entity.getById(id);
  };

  const sourceFactory: Source<TIdentity, TPayload, TData, TMeta> = (identity) => {
    const unitKey = unitKeyCache.getOrCreateKey(identity);
    const existingUnit = unitsByKey.get(unitKey);

    if (existingUnit) {
      return existingUnit.unit;
    }

    const initialValue = (defaultValue ?? null) as TData;
    const initialPayload = undefined as TPayload;
    const initialMode: 'one' | 'many' = Array.isArray(initialValue) ? 'many' : 'one';

    const internal: SourceUnitInternal<TIdentity, TPayload, TData, TMeta> = {
      key: unitKey,
      ttl,
      destroyDelay,
      identity,
      payload: initialPayload,
      state: {
        value: initialValue,
        status: 'idle',
        meta: null,
        context: createInitialSourceContext(Boolean(cacheStorage)),
      },
      mode: initialMode,
      modeLocked: false,
      hasEntityValue: false,
      membershipIds: [],
      readWrite: {
        subview: entity.readWrite.subview,
      },
      listeners: new Set<EffectListener<TData, TMeta | null>>(),
      inFlightByPayload: new Map<string, Promise<TData>>(),
      runSequence: 0,
      latestRunSequence: 0,
      lastRunAt: null,
      cleanup: null,
      stopped: false,
      destroyed: false,
      destroyHandled: false,
      unit: {} as SourceUnit<TIdentity, TPayload, TData, TMeta>,
    };
    const payloadKeyCache = createSerializedKeyCache({
      mode: 'payload-hot-path',
      limit: RUN_CONTEXT_CACHE_LIMIT,
    });
    const refreshValueFromEntity = (): void => {
      internal.state.value = getModeValue(internal, readEntityValueById);
    };
    const setRawValue = (value: TData): void => {
      internal.state.value = value;
    };

    const notifyUnit = (): void => {
      refreshValueFromEntity();
      notifyEffectListeners(
        internal.listeners,
        createUnitSnapshot({
          value: internal.state.value,
          status: internal.state.status,
          meta: internal.state.meta,
          context: internal.state.context,
        }),
      );
    };

    const createRunContextEntry = (
      payload: TPayload,
    ): SourceRunContextEntry<TIdentity, TPayload, TData, TMeta> => {
      const gate: SourceRunGate = {
        isLatestRun: () => false,
      };
      const runContextMethods = createEntityRunContextMethods<
        UnitDataEntity<TData>,
        TData,
        EntityId
      >({
        entity,
        state: internal,
        isActive: () => gate.isLatestRun(),
        refreshValue: refreshValueFromEntity,
        readValue: () => internal.state.value,
      });
      const runContextBase: SourceRunContext<
        TIdentity,
        TPayload,
        TData,
        TMeta
      > = {
        identity: internal.identity,
        payload,
        setMeta: (metaInput: TMeta | null | ValueUpdater<TMeta | null, TMeta | null>) => {
          if (!gate.isLatestRun()) {
            return;
          }

          const nextMeta = resolveValue(
            internal.state.meta,
            metaInput,
          );
          if (Object.is(nextMeta, internal.state.meta)) {
            return;
          }

          internal.state.meta = nextMeta;
          notifyUnit();
        },
        set: (input: TData | ValueUpdater<TData, TData>) => {
          if (!gate.isLatestRun()) {
            return;
          }

          const nextValue = resolveValue(internal.state.value, input);
          applyEntityRunResult({
            entity,
            state: internal,
            nextValue,
            refreshValueFromMembership: refreshValueFromEntity,
            setRawValue,
            upsertOneOperation: 'runContext.set() object',
            upsertManyOperation: 'runContext.set() array',
          });

          if (!gate.isLatestRun()) {
            return;
          }

          notifyUnit();
          syncCacheRecord();
        },
        reset: () => {
          if (!gate.isLatestRun()) {
            return;
          }

          resetState();
        },
        ...runContextMethods,
      };

      return {
        gate,
        context: runContextBase,
      };
    };
    const runContextEntryCache = createRunContextEntryCache<
      TPayload,
      SourceRunContextEntry<TIdentity, TPayload, TData, TMeta>
    >({
      createEntry: createRunContextEntry,
      limit: RUN_CONTEXT_CACHE_LIMIT,
    });

    const setContext = (input: Partial<SourceContext>): void => {
      const hasCacheState = Object.prototype.hasOwnProperty.call(input, 'cacheState');
      const hasError = Object.prototype.hasOwnProperty.call(input, 'error');

      if (
        (!hasCacheState || input.cacheState === internal.state.context.cacheState)
        && (!hasError || Object.is(input.error, internal.state.context.error))
      ) {
        return;
      }

      internal.state.context = {
        ...internal.state.context,
        ...input,
      };
    };

    const cacheEnabled = Boolean(
      cacheStorage
      && (cacheTtl === 'infinity' || cacheTtl > 0),
    );
    const cacheSupportsStructuredValues = cacheStorage?.supportsStructuredValues === true;
    const cacheLruEnabled = Boolean(
      cacheEnabled
      && cacheLruMaxEntries > 0
      && cacheStorage
      && cacheWriteQueue,
    );
    const cacheLruStorageKey = `${cacheKeyPrefix}:${SOURCE_CACHE_LRU_STORAGE_KEY_SUFFIX}`;
    let cacheLruLoaded = false;
    let cacheLruKeyOrderMap = new Map<string, true>();
    let cacheLruNewestKey: string | null = null;
    let cacheLruPersistScheduled = false;
    let cacheLruPersistDirty = false;
    let activePayloadCacheKey: string | null = null;

    const readNewestCacheLruKey = (): string | null => {
      let nextNewestKey: string | null = null;
      cacheLruKeyOrderMap.forEach((_present, currentKey) => {
        nextNewestKey = currentKey;
      });

      return nextNewestKey;
    };

    const readPersistedCacheLruKeys = (): string[] => {
      return Array.from(cacheLruKeyOrderMap.keys()).reverse();
    };

    const loadCacheLruState = (): void => {
      if (!cacheLruEnabled || cacheLruLoaded || !cacheStorage) {
        return;
      }

      cacheLruLoaded = true;
      const rawLruState = cacheStorage.getItem(cacheLruStorageKey);
      if (!rawLruState) {
        return;
      }

      let parsedLruState: unknown = rawLruState;
      try {
        if (typeof rawLruState === 'string') {
          parsedLruState = JSON.parse(rawLruState);
        }
      } catch {
        return;
      }
      if (!hasStringKeysArray(parsedLruState)) {
        return;
      }

      const keysCandidate = parsedLruState.keys;
      try {
        const nextKeyOrderMap = new Map<string, true>();
        keysCandidate
          .slice()
          .reverse()
          .forEach((entry) => {
            nextKeyOrderMap.set(entry, true);
          });

        cacheLruKeyOrderMap = nextKeyOrderMap;
        cacheLruNewestKey = readNewestCacheLruKey();
      } catch {
        return;
      }
    };

    const persistCacheLruState = (): void => {
      if (!cacheLruEnabled || !cacheWriteQueue) {
        return;
      }

      if (cacheLruKeyOrderMap.size === 0) {
        cacheWriteQueue.enqueueRemove(cacheLruStorageKey);
        return;
      }

      const persistedKeys = readPersistedCacheLruKeys();
      cacheWriteQueue.enqueueSet(
        cacheLruStorageKey,
        () => {
          if (cacheSupportsStructuredValues) {
            return {
              keys: persistedKeys,
            };
          }

          return JSON.stringify({
            keys: persistedKeys,
          });
        },
      );
    };

    const flushCacheLruPersistence = (): void => {
      if (!cacheLruPersistDirty) {
        return;
      }

      cacheLruPersistDirty = false;
      persistCacheLruState();
    };

    const scheduleCacheLruPersistence = (): void => {
      cacheLruPersistDirty = true;

      if (cacheLruPersistScheduled) {
        return;
      }

      cacheLruPersistScheduled = true;
      scheduleAsync({
        callback: () => {
          cacheLruPersistScheduled = false;
          flushCacheLruPersistence();
        },
      });
    };

    const touchCacheLruKey = (unitCacheKey: string): void => {
      if (!cacheLruEnabled || !cacheWriteQueue) {
        return;
      }

      loadCacheLruState();
      if (cacheLruNewestKey === unitCacheKey) {
        return;
      }

      if (cacheLruKeyOrderMap.has(unitCacheKey)) {
        cacheLruKeyOrderMap.delete(unitCacheKey);
        cacheLruKeyOrderMap.set(unitCacheKey, true);
        cacheLruNewestKey = unitCacheKey;
        scheduleCacheLruPersistence();
        return;
      }

      cacheLruKeyOrderMap.set(unitCacheKey, true);
      cacheLruNewestKey = unitCacheKey;
      const evictedEntry = cacheLruKeyOrderMap.size > cacheLruMaxEntries
        ? cacheLruKeyOrderMap.keys().next().value
        : undefined;
      if (evictedEntry && evictedEntry !== unitCacheKey) {
        cacheLruKeyOrderMap.delete(evictedEntry);
        cacheWriteQueue.enqueueRemove(evictedEntry);
      }

      scheduleCacheLruPersistence();
    };

    const removeCacheLruKey = (unitCacheKey: string): void => {
      if (!cacheLruEnabled) {
        return;
      }

      loadCacheLruState();
      const existed = cacheLruKeyOrderMap.delete(unitCacheKey);
      if (!existed) {
        return;
      }

      if (cacheLruNewestKey === unitCacheKey) {
        cacheLruNewestKey = readNewestCacheLruKey();
      }

      scheduleCacheLruPersistence();
    };

    const resolvePayloadCacheKey = (payload: TPayload): string => {
      return payloadKeyCache.getOrCreateKey(payload);
    };

    const resolveUnitCacheKey = (payloadCacheKey: string): string => {
      return `${cacheKeyPrefix}:${unitKey}:${payloadCacheKey}`;
    };
    const resolveUnitCacheKeyPrefix = (): string => {
      return `${cacheKeyPrefix}:${unitKey}:`;
    };
    const readUnitCacheLruCandidates = ({
      excludeUnitCacheKey,
    }: ReadUnitCacheLruCandidatesInput): string[] => {
      if (!cacheLruEnabled) {
        return [];
      }

      loadCacheLruState();
      const unitCacheKeyPrefix = resolveUnitCacheKeyPrefix();
      return readPersistedCacheLruKeys().filter((entry) => {
        return entry !== excludeUnitCacheKey
          && entry.startsWith(unitCacheKeyPrefix);
      });
    };

    const syncCacheRecord = (): void => {
      if (!cacheEnabled || !cacheWriteQueue) {
        return;
      }

      const payloadCacheKey = resolvePayloadCacheKey(internal.payload);
      const unitCacheKey = resolveUnitCacheKey(payloadCacheKey);
      if (!internal.hasEntityValue) {
        removeCacheLruKey(unitCacheKey);
        cacheWriteQueue.enqueueRemove(unitCacheKey);
        return;
      }

      touchCacheLruKey(unitCacheKey);
      cacheWriteQueue.enqueueSet(unitCacheKey, () => {
        const entities = internal.membershipIds
          .map((id) => entity.getById(id))
          .filter((entry): entry is UnitDataEntity<TData> => entry !== undefined);
        const record = {
          mode: internal.mode,
          entities,
          writtenAt: Date.now(),
        };
        if (cacheSupportsStructuredValues) {
          return record;
        }

        return serializeSourceCacheRecord(record);
      });
    };

    const hydrateFromUnitCacheKey = ({
      unitCacheKey,
      cacheStateOnHit,
    }: HydrateFromUnitCacheKeyInput): boolean => {
      if (!cacheStorage) {
        setContext({
          cacheState: 'disabled',
        });
        return false;
      }

      if (!cacheEnabled) {
        setContext({
          cacheState: 'disabled',
        });
        return false;
      }

      const rawRecord = cacheStorage.getItem(unitCacheKey);
      const parsedRecord = readSourceCacheRecord<UnitDataEntity<TData>>(rawRecord);
      if (!parsedRecord) {
        setContext({
          cacheState: 'miss',
        });
        return false;
      }

      if (isCacheRecordExpired({ ttl: cacheTtl, writtenAt: parsedRecord.writtenAt })) {
        removeCacheLruKey(unitCacheKey);
        if (cacheWriteQueue) {
          cacheWriteQueue.enqueueRemove(unitCacheKey);
        } else {
          try {
            cacheStorage.removeItem(unitCacheKey);
          } catch {
            // Ignore storage write errors and continue with stale cache behavior.
          }
        }
        setContext({
          cacheState: 'stale',
        });
        return false;
      }

      touchCacheLruKey(unitCacheKey);
      if (parsedRecord.mode === 'one') {
        const firstEntity = parsedRecord.entities[0];
        internal.hasEntityValue = true;

        if (firstEntity) {
          const upsertedEntity = entity.upsertOne(firstEntity);
          setOneEntityMembership(internal, {
            entity,
            value: upsertedEntity,
            operation: 'cache rehydrate one',
          });
          refreshValueFromEntity();
        } else {
          clearEntityMembership(internal, { clearUnitMembership: entity.clearUnitMembership });
          refreshValueFromEntity();
        }
      }

      if (parsedRecord.mode === 'many') {
        const upsertedEntities = entity.upsertMany(parsedRecord.entities);
        setManyEntityMembership(internal, {
          entity,
          values: upsertedEntities,
          operation: 'cache rehydrate many',
        });
        refreshValueFromEntity();
      }

      internal.state.status = 'rehydrated';
      setContext({
        cacheState: cacheStateOnHit,
        error: null,
      });
      return true;
    };

    const hydrateFromPayloadCache = (payload: TPayload): boolean => {
      const payloadCacheKey = resolvePayloadCacheKey(payload);
      if (activePayloadCacheKey === payloadCacheKey) {
        return false;
      }

      const unitCacheKey = resolveUnitCacheKey(payloadCacheKey);
      const didHydrateFromPrimary = hydrateFromUnitCacheKey({
        unitCacheKey,
        cacheStateOnHit: 'hit',
      });
      if (didHydrateFromPrimary) {
        activePayloadCacheKey = payloadCacheKey;
        return true;
      }

      const fallbackCandidates = readUnitCacheLruCandidates({
        excludeUnitCacheKey: unitCacheKey,
      });
      let didHydrateFromFallback = false;
      fallbackCandidates.some((fallbackUnitCacheKey) => {
        didHydrateFromFallback = hydrateFromUnitCacheKey({
          unitCacheKey: fallbackUnitCacheKey,
          cacheStateOnHit: 'stale',
        });
        return didHydrateFromFallback;
      });
      if (didHydrateFromFallback) {
        activePayloadCacheKey = payloadCacheKey;
      }
      return didHydrateFromFallback;
    };

    entity.registerUnit({
      key: internal.key,
      onChange: () => {
        if (internal.destroyed) {
          return;
        }

        notifyUnit();
        syncCacheRecord();
      },
    });

    hydrateFromPayloadCache(internal.payload);

    let singleInFlightPromise: Promise<TData> | null = null;
      let hasSingleInFlightPayload = false;
      let singleInFlightPayload: TPayload | undefined;
      let singleInFlightPayloadKey: string | null = null;
      let runConfig: SourceRunConfig | undefined;

    const clearInFlightTracking = (): void => {
      internal.inFlightByPayload.clear();
      singleInFlightPromise = null;
      hasSingleInFlightPayload = false;
      singleInFlightPayload = undefined;
      singleInFlightPayloadKey = null;
    };

    const stopInternal = (): void => {
      internal.runSequence += 1;
      internal.latestRunSequence = internal.runSequence;
      internal.stopped = true;
      invokeSourceCleanup(internal.cleanup);
      internal.cleanup = null;
    };

    const resetState = (): void => {
      if (internal.destroyed) {
        return;
      }

      stopInternal();
      clearInFlightTracking();
      runContextEntryCache.clear();
      payloadKeyCache.clear();
      activePayloadCacheKey = null;
      internal.payload = initialPayload;

      clearEntityMembership(internal, { clearUnitMembership: entity.clearUnitMembership });
      internal.mode = initialMode;
      internal.modeLocked = false;
      internal.lastRunAt = null;
      internal.stopped = false;
      internal.state.value = initialValue;
      internal.state.status = 'idle';
      internal.state.meta = null;
      internal.state.context = createInitialSourceContext(Boolean(cacheStorage));
      notifyUnit();
      syncCacheRecord();
    };

    const executeRun = (
      isForce: boolean,
      payloadInput?: TPayload,
    ): Promise<TData> => {
      if (internal.destroyed) {
        return Promise.resolve(internal.state.value);
      }

      const hasPayloadInput = payloadInput !== undefined;
      const nextPayload = resolveInput(internal.payload, payloadInput);
      if (hasPayloadInput) {
        internal.payload = nextPayload;
      }
      let payloadKey: string | null = null;
      if (singleInFlightPromise) {
        if (hasSingleInFlightPayload && Object.is(singleInFlightPayload, internal.payload)) {
          return singleInFlightPromise;
        }

        payloadKey = payloadKeyCache.getOrCreateKey(internal.payload);
        if (singleInFlightPayloadKey === null && hasSingleInFlightPayload) {
          singleInFlightPayloadKey = payloadKeyCache.getOrCreateKey(singleInFlightPayload);
        }

        if (singleInFlightPayloadKey === payloadKey) {
          return singleInFlightPromise;
        }
      }

      if (internal.inFlightByPayload.size > 0) {
        payloadKey ??= payloadKeyCache.getOrCreateKey(internal.payload);
        const inFlightForPayload = internal.inFlightByPayload.get(payloadKey);
        if (inFlightForPayload) {
          return inFlightForPayload;
        }
      }

      internal.stopped = false;
      internal.runSequence += 1;
      internal.latestRunSequence = internal.runSequence;
      const runSequence = internal.runSequence;
      const isLatestRun = () => {
        return internal.latestRunSequence === runSequence && !internal.destroyed;
      };

      const didHydrateFromPayloadCache = hydrateFromPayloadCache(internal.payload);
      if (didHydrateFromPayloadCache && isLatestRun()) {
        notifyUnit();
      }

      if (!isForce && !hasPayloadInput && shouldUseCache(internal)) {
        return Promise.resolve(internal.state.value);
      }

      const shouldUseRefreshingStatus = internal.state.status === 'rehydrated'
        || internal.state.status === 'success';
      if (isLatestRun()) {
        internal.state.status = shouldUseRefreshingStatus ? 'refreshing' : 'loading';
        setContext({
          error: null,
        });
        notifyUnit();
      }

      const runContextEntry = runContextEntryCache.getOrCreate(internal.payload);
      runContextEntry.gate.isLatestRun = isLatestRun;
      runContextEntry.context.payload = internal.payload;

      const usesSingleInFlight = singleInFlightPromise === null && internal.inFlightByPayload.size === 0;
      const trackedPayloadKey = usesSingleInFlight
        ? null
        : (payloadKey ?? payloadKeyCache.getOrCreateKey(internal.payload));

      const runPromise: Promise<TData> = Promise.resolve(run(runContextEntry.context))
        .then((result) => {
          if (isSourceCleanup(result)) {
            if (!isLatestRun()) {
              invokeSourceCleanup(result);
              return internal.state.value;
            }

            if (internal.destroyed || internal.stopped) {
              invokeSourceCleanup(result);
            } else {
              invokeSourceCleanup(internal.cleanup);
              internal.cleanup = result;
            }

            refreshValueFromEntity();
          } else if (result !== undefined) {
            throw new TypeError(SOURCE_RUN_RESULT_ERROR);
          }

          if (!isLatestRun()) {
            return internal.state.value;
          }

          internal.lastRunAt = Date.now();
          internal.state.status = 'success';
          setContext({
            error: null,
          });
          notifyUnit();
          syncCacheRecord();

          return internal.state.value;
        })
        .catch((error: unknown) => {
          if (isLatestRun()) {
            internal.state.status = 'error';
            setContext({
              error,
            });
            notifyUnit();
          }

          throw error;
        })
        .finally(() => {
          if (usesSingleInFlight) {
            if (singleInFlightPromise === runPromise) {
              singleInFlightPromise = null;
              hasSingleInFlightPayload = false;
              singleInFlightPayload = undefined;
              singleInFlightPayloadKey = null;
            }
            return;
          }

          if (trackedPayloadKey !== null) {
            internal.inFlightByPayload.delete(trackedPayloadKey);
          }
        });

      if (usesSingleInFlight) {
        singleInFlightPromise = runPromise;
        hasSingleInFlightPayload = true;
        singleInFlightPayload = internal.payload;
        singleInFlightPayloadKey = null;
      } else {
        if (trackedPayloadKey !== null) {
          internal.inFlightByPayload.set(trackedPayloadKey, runPromise);
        }
      }

      return runPromise;
    };

    const getSnapshot = () => {
      return createUnitSnapshot({
        value: internal.state.value,
        status: internal.state.status,
        meta: internal.state.meta,
        context: internal.state.context,
      });
    };
    const subscribe = (listener: EffectListener<TData, TMeta | null>) => {
      if (internal.destroyed) {
        return undefined;
      }

      internal.listeners.add(listener);

      return () => {
        internal.listeners.delete(listener);
      };
    };
    const runUnit: SourceRun<TPayload, TData, TMeta> = (
      input?: SourceRunInput<TPayload, TData, TMeta>,
      config?: SourceRunConfig,
    ) => {
        if (config) {
          runConfig = config;
        }

        let payloadInput: TPayload | undefined;
        if (isSourceSetAction<TPayload, TData, TMeta>(input)) {
          const previous: UnitRunPrevious<
            TPayload,
            SourceRunConfig,
            TData,
            TMeta | null
          > = {
            snapshot: getSnapshot(),
            data: internal.payload,
            config: runConfig,
          };
          payloadInput = input(previous, config);
        } else {
          payloadInput = input;
        }

        if (config?.mode === 'force' || config?.mode === 'refetch') {
          return executeRun(true, payloadInput).then(resolveRunAsVoid);
        }
        return executeRun(false, payloadInput).then(resolveRunAsVoid);
      };
    const unit: SourceUnit<TIdentity, TPayload, TData, TMeta> = {
      identity: internal.identity,
      run: runUnit,
      getSnapshot,
      subscribe,
    };

    internal.unit = unit;
    unitsByKey.set(unitKey, internal);

    return unit;
  };

  return sourceFactory;
};
