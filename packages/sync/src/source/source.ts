import {
  type Entity,
  type EntityId,
} from '../entity.js';
import {
  DEFAULT_RUN_CONTEXT_CACHE_LIMIT,
  DEFAULT_UNIT_DESTROY_DELAY,
  applyEntityRunResult,
  clearEntityMembership,
  createEntityValueReader,
  createEntityRunContextMethods,
  createFunctionKeyResolver,
  createRunContextEntryCache,
  createSerializedKeyCache,
  createUnitSnapshot,
  invokeCleanup,
  isCleanup,
  isUnitSnapshotEqual,
  isNonEmptyString,
  isUnitSetAction,
  notifyEffectListeners,
  resolveEntityFunctionIdentityKey,
  resolveEntityFunctionKey,
  resolveDefaultUnitValue,
  resolveInput,
  resolveUnitRunAsVoid,
  resolveUnitMode,
  resolveValue,
  type EntityValueOfStore,
  serializeKey,
  setManyEntityMembership,
  setOneEntityMembership,
  type EffectListener,
  type UnitDataByEntityMode,
  type UnitEntityMode,
  type UnitRunPrevious,
  type UnitSnapshot,
  type ValueUpdater,
} from '../utils/index.js';

import {
  getModeValue,
  hasStringKeysArray,
  isCacheRecordExpired,
  readSourceCacheRecord,
  resolveCacheLruMaxEntries,
  resolveCacheKey,
  resolveCacheStorage,
  resolveCacheTtl,
  shouldUseCache,
} from './helpers.js';
import type {
  ReadEntityValueById,
  Source,
  SourceBuilderInput,
  SourceByEntityModeBuilder,
  SourceBuilder,
  SourceConfig,
  SourceContext,
  SourceRunConfig,
  SourceRun,
  SourceRunInput,
  SourceFetchInput,
  SourceRunContext,
  SourceRunContextEntry,
  SourceRunGate,
  SourceSnapshot,
  SourceUnit,
  SourceUnitByKeyMap,
  SourceUnitInternal,
} from './types.js';

const SOURCE_CACHE_LRU_STORAGE_KEY_SUFFIX = '__lru__';
const SOURCE_CACHE_ENTITY_KEY_ERROR = 'entity.key is required when source cache is enabled.';
const SOURCE_CACHE_SOURCE_KEY_ERROR = 'source.key is required when source cache is enabled.';
const SOURCE_RUN_RESULT_ERROR = 'source.run() must return void or a cleanup function.';
const resolveSourceFunctionKey = createFunctionKeyResolver({
  prefix: 'source-fallback',
});

interface HydrateFromUnitCacheKeyInput {
  unitCacheKey: string;
  cacheStateOnHit: 'hit';
}

interface CreateSourceFromConfigInput<
  TEntity extends object,
  TMode extends UnitEntityMode,
> {
  entity: Entity<TEntity, EntityId>;
  mode: TMode;
  readEntityValueByIdOverride?: ReadEntityValueById<EntityId, TEntity>;
}

const createInitialSourceContext = (
  hasEnabledCache: boolean,
): SourceContext => {
  return {
    cacheState: hasEnabledCache ? 'miss' : 'disabled',
    error: null,
  };
};

export const createSourceFromConfig = <
  TIdentity extends object | undefined,
  TPayload,
  TMeta,
  TEntity extends object,
  TMode extends UnitEntityMode,
>(
{
  entity,
  mode,
  readEntityValueByIdOverride,
}: CreateSourceFromConfigInput<TEntity, TMode>,
{
  key: sourceKey,
  ttl = entity.ttl ?? 0,
  cache,
  destroyDelay = entity.destroyDelay ?? DEFAULT_UNIT_DESTROY_DELAY,
  run,
  defaultValue,
}: SourceConfig<TIdentity, TPayload, TEntity, TMode, TMeta>,
): Source<TIdentity, TPayload, UnitDataByEntityMode<TEntity, TMode>, TMeta> => {
  type TData = UnitDataByEntityMode<TEntity, TMode>;
  const cacheTtl = resolveCacheTtl({
    sourceCache: cache,
    entityCache: entity.cache,
  });
  const cacheLruMaxEntries = resolveCacheLruMaxEntries({
    sourceCache: cache,
    entityCache: entity.cache,
  });
  const cacheStorage = resolveCacheStorage();
  const normalizedEntityKey = isNonEmptyString(entity.key)
    ? entity.key
    : '';
  const hasValidSourceFunctionKey = isNonEmptyString(sourceKey);
  const resolvedSourceFunctionKey = resolveSourceFunctionKey(sourceKey);
  const {
    mode: resolvedSourceMode,
    modeLocked: resolvedModeLocked,
  } = resolveUnitMode({
    entityMode: mode,
    defaultValue,
  });
  const hasConfiguredCacheEnabled = Boolean(
    cacheStorage
    && (cacheTtl === 'infinity' || cacheTtl > 0),
  );
  if (hasConfiguredCacheEnabled && normalizedEntityKey.length === 0) {
    throw new Error(SOURCE_CACHE_ENTITY_KEY_ERROR);
  }
  if (hasConfiguredCacheEnabled && !hasValidSourceFunctionKey) {
    throw new Error(SOURCE_CACHE_SOURCE_KEY_ERROR);
  }
  const sourceEntityFunctionKey = resolveEntityFunctionKey({
    entityKey: normalizedEntityKey,
    functionKey: serializeKey({
      sourceKey: resolvedSourceFunctionKey,
      entityMode: resolvedSourceMode,
    }),
  });
  const cacheKeyPrefix = resolveCacheKey({
    sourceKey: sourceEntityFunctionKey,
  });

  const unitsByKey: SourceUnitByKeyMap<TIdentity, TPayload, TData, TMeta> =
    new Map<string, SourceUnitInternal<TIdentity, TPayload, TData, TMeta>>();
  const unitKeyCache = createSerializedKeyCache({
    mode: 'identity-unit',
  });

  const sourceFactory: Source<TIdentity, TPayload, TData, TMeta> = (identity) => {
    const identityKey = unitKeyCache.getOrCreateKey(identity);
    const unitKey = resolveEntityFunctionIdentityKey({
      entityFunctionKey: sourceEntityFunctionKey,
      identityKey,
    });
    const readEntityValueById: ReadEntityValueById<EntityId, TEntity> = readEntityValueByIdOverride
      ?? createEntityValueReader<TEntity, EntityId>({
        entity,
        identityKey,
        localIdentityKey: unitKey,
      });
    const existingUnit = unitsByKey.get(unitKey);

    if (existingUnit) {
      return existingUnit.unit;
    }

    const initialValue = resolveDefaultUnitValue({
      defaultValue,
      mode: resolvedSourceMode,
    }) as TData;
    const initialPayload = undefined as TPayload;
    const initialMode: 'one' | 'many' = resolvedSourceMode;

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
        context: createInitialSourceContext(
          hasConfiguredCacheEnabled && cacheStorage?.readStatus() !== 'disabled',
        ),
      },
      mode: initialMode,
      modeLocked: resolvedModeLocked,
      hasEntityValue: false,
      membershipIds: [],
      readWrite: {
        subview: entity.readWrite.subview,
      },
      listeners: new Set<EffectListener<TData, TMeta | null, SourceContext>>(),
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
      limit: DEFAULT_RUN_CONTEXT_CACHE_LIMIT,
    });
    let isValueDirty = false;
    const refreshValueFromEntity = (): void => {
      internal.state.value = getModeValue(internal, readEntityValueById);
      isValueDirty = false;
    };
    const setRawValue = (value: TData): void => {
      internal.state.value = value;
      isValueDirty = false;
    };
    const markValueDirty = (): void => {
      isValueDirty = true;
    };
    const ensureValueFresh = (): void => {
      if (!isValueDirty) {
        return;
      }

      refreshValueFromEntity();
    };
    let snapshotCache: UnitSnapshot<TData, TMeta | null, SourceContext, TIdentity> = createUnitSnapshot({
      identity: internal.identity,
      value: internal.state.value,
      status: internal.state.status,
      meta: internal.state.meta,
      context: internal.state.context,
    });
    let lastNotifiedSnapshot = snapshotCache;

    const readSnapshot = (): UnitSnapshot<TData, TMeta | null, SourceContext, TIdentity> => {
      if (
        snapshotCache.status === internal.state.status
        && Object.is(snapshotCache.value, internal.state.value)
        && Object.is(snapshotCache.meta, internal.state.meta)
        && Object.is(snapshotCache.context, internal.state.context)
      ) {
        return snapshotCache;
      }

      if (isUnitSnapshotEqual({
        left: snapshotCache,
        right: internal.state,
      })) {
        return snapshotCache;
      }

      snapshotCache = createUnitSnapshot({
        identity: internal.identity,
        value: internal.state.value,
        status: internal.state.status,
        meta: internal.state.meta,
        context: internal.state.context,
      });
      return snapshotCache;
    };

    const notifyUnit = (): void => {
      ensureValueFresh();
      const nextSnapshot = readSnapshot();

      if (internal.listeners.size === 0) {
        return;
      }

      if (Object.is(lastNotifiedSnapshot, nextSnapshot)) {
        return;
      }

      lastNotifiedSnapshot = nextSnapshot;
      notifyEffectListeners(
        internal.listeners,
        nextSnapshot,
      );
    };

    const createRunContextEntry = (
      payload: TPayload,
    ): SourceRunContextEntry<TIdentity, TPayload, TData, TMeta, TEntity> => {
      const gate: SourceRunGate = {
        isLatestRun: () => false,
      };
      const runContextMethods = createEntityRunContextMethods<
        TEntity,
        TData,
        EntityId
      >({
        entity,
        state: internal,
        isActive: () => gate.isLatestRun(),
        refreshValue: refreshValueFromEntity,
        readValue: () => internal.state.value,
        refreshOnGet: true,
        refreshStrategy: 'lazy',
      });
      const runContextBase: SourceRunContext<
        TIdentity,
        TPayload,
        TData,
        TMeta,
        TEntity
      > = {
        identity: internal.identity,
        value: internal.state.value,
        status: internal.state.status,
        meta: internal.state.meta,
        context: internal.state.context,
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
          runContextBase.meta = nextMeta;
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

          runContextBase.value = internal.state.value;
          notifyUnit();
          requestCacheSync();
        },
        reset: () => {
          if (!gate.isLatestRun()) {
            return;
          }

          resetState();
          runContextBase.value = internal.state.value;
          runContextBase.status = internal.state.status;
          runContextBase.meta = internal.state.meta;
          runContextBase.context = internal.state.context;
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
      SourceRunContextEntry<TIdentity, TPayload, TData, TMeta, TEntity>
    >({
      createEntry: createRunContextEntry,
      limit: DEFAULT_RUN_CONTEXT_CACHE_LIMIT,
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

    const cacheEnabled = hasConfiguredCacheEnabled;
    const isCacheUnavailable = (): boolean => {
      if (!cacheStorage) {
        return true;
      }

      return cacheStorage.readStatus() === 'disabled';
    };

    const isCacheLruEnabled = (): boolean => {
      return cacheEnabled
        && cacheLruMaxEntries > 0
        && !isCacheUnavailable();
    };
    const cacheLruStorageKey = `${cacheKeyPrefix}:${SOURCE_CACHE_LRU_STORAGE_KEY_SUFFIX}`;
    let cacheLruLoaded = false;
    let cacheLruKeyOrderMap = new Map<string, true>();
    let cacheLruNewestKey: string | null = null;
    let hasHydratedFromIdentityCache = false;
    let activeRunCount = 0;
    let hasPendingCacheSync = false;

    const syncDisabledCacheContext = (): void => {
      if (!cacheStorage || cacheStorage.readStatus() !== 'disabled') {
        return;
      }

      setContext({
        cacheState: 'disabled',
        error: cacheStorage.readFailure(),
      });
    };

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
      if (!isCacheLruEnabled() || cacheLruLoaded || !cacheStorage) {
        return;
      }

      cacheLruLoaded = true;
      let rawLruState: unknown | null = null;
      try {
        rawLruState = cacheStorage.getItem(cacheLruStorageKey);
      } catch {
        syncDisabledCacheContext();
        return;
      }

      if (!rawLruState) {
        return;
      }

      if (!hasStringKeysArray(rawLruState)) {
        return;
      }

      const keysCandidate = rawLruState.keys;
      const nextKeyOrderMap = new Map<string, true>();
      keysCandidate
        .slice()
        .reverse()
        .forEach((entry) => {
          nextKeyOrderMap.set(entry, true);
        });

      cacheLruKeyOrderMap = nextKeyOrderMap;
      cacheLruNewestKey = readNewestCacheLruKey();
    };

    const persistCacheLruState = (): void => {
      if (!isCacheLruEnabled() || !cacheStorage) {
        return;
      }

      try {
        if (cacheLruKeyOrderMap.size === 0) {
          cacheStorage.removeItem(cacheLruStorageKey);
          return;
        }

        const persistedKeys = readPersistedCacheLruKeys();
        cacheStorage.setItem(cacheLruStorageKey, {
          keys: persistedKeys,
        });
      } catch {
        syncDisabledCacheContext();
      }
    };

    const touchCacheLruKey = (unitCacheKey: string): void => {
      if (!isCacheLruEnabled() || !cacheStorage) {
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
        persistCacheLruState();
        return;
      }

      cacheLruKeyOrderMap.set(unitCacheKey, true);
      cacheLruNewestKey = unitCacheKey;
      const evictedEntry = cacheLruKeyOrderMap.size > cacheLruMaxEntries
        ? cacheLruKeyOrderMap.keys().next().value
        : undefined;
      if (evictedEntry && evictedEntry !== unitCacheKey) {
        cacheLruKeyOrderMap.delete(evictedEntry);
        try {
          cacheStorage.removeItem(evictedEntry);
        } catch {
          syncDisabledCacheContext();
          return;
        }
      }

      persistCacheLruState();
    };

    const removeCacheLruKey = (unitCacheKey: string): void => {
      if (!isCacheLruEnabled()) {
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

      persistCacheLruState();
    };

    const resolveUnitCacheKey = (): string => {
      return `${cacheKeyPrefix}:${unitKey}`;
    };

    const syncCacheRecord = (): void => {
      if (!cacheEnabled || !cacheStorage || isCacheUnavailable()) {
        syncDisabledCacheContext();
        return;
      }

      const unitCacheKey = resolveUnitCacheKey();
      if (!internal.hasEntityValue) {
        removeCacheLruKey(unitCacheKey);
        try {
          cacheStorage.removeItem(unitCacheKey);
        } catch {
          syncDisabledCacheContext();
        }
        return;
      }

      touchCacheLruKey(unitCacheKey);
      if (!cacheEnabled) {
        return;
      }

      const entities = internal.membershipIds
        .map((id) => readEntityValueById(id))
        .filter((entry): entry is TEntity => entry !== undefined);
      const record = {
        mode: internal.mode,
        entities,
        writtenAt: Date.now(),
      };
      try {
        cacheStorage.setItem(unitCacheKey, record);
      } catch {
        syncDisabledCacheContext();
      }
    };
    const requestCacheSync = (): void => {
      if (activeRunCount > 0) {
        hasPendingCacheSync = true;
        return;
      }

      syncCacheRecord();
    };
    const flushPendingCacheSync = (): void => {
      if (!hasPendingCacheSync || activeRunCount > 0) {
        return;
      }

      hasPendingCacheSync = false;
      syncCacheRecord();
    };

    const hydrateFromUnitCacheKey = ({
      unitCacheKey,
      cacheStateOnHit,
    }: HydrateFromUnitCacheKeyInput): boolean => {
      if (!cacheStorage || !cacheEnabled || isCacheUnavailable()) {
        setContext({
          cacheState: 'disabled',
          error: cacheStorage?.readFailure() ?? null,
        });
        return false;
      }

      let rawRecord: unknown | null = null;
      try {
        rawRecord = cacheStorage.getItem(unitCacheKey);
      } catch {
        syncDisabledCacheContext();
        return false;
      }

      const parsedRecord = readSourceCacheRecord<TEntity>(rawRecord);
      if (!parsedRecord) {
        setContext({
          cacheState: 'miss',
        });
        return false;
      }

      if (isCacheRecordExpired({ ttl: cacheTtl, writtenAt: parsedRecord.writtenAt })) {
        removeCacheLruKey(unitCacheKey);
        try {
          cacheStorage.removeItem(unitCacheKey);
        } catch {
          syncDisabledCacheContext();
          return false;
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
    const hydrateFromIdentityCache = (): boolean => {
      if (hasHydratedFromIdentityCache) {
        return false;
      }

      const unitCacheKey = resolveUnitCacheKey();
      const didHydrate = hydrateFromUnitCacheKey({
        unitCacheKey,
        cacheStateOnHit: 'hit',
      });
      hasHydratedFromIdentityCache = didHydrate;
      return didHydrate;
    };

    entity.registerUnit({
      key: internal.key,
      onChange: () => {
        if (internal.destroyed) {
          return;
        }

        markValueDirty();
        if (internal.listeners.size > 0) {
          notifyUnit();
        }
        requestCacheSync();
      },
    });

    hydrateFromIdentityCache();

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
      invokeCleanup(internal.cleanup);
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
      hasHydratedFromIdentityCache = false;
      internal.payload = initialPayload;

      clearEntityMembership(internal, { clearUnitMembership: entity.clearUnitMembership });
      internal.mode = initialMode;
      internal.modeLocked = resolvedModeLocked;
      internal.lastRunAt = null;
      internal.stopped = false;
      internal.state.value = initialValue;
      isValueDirty = false;
      internal.state.status = 'idle';
      internal.state.meta = null;
      internal.state.context = createInitialSourceContext(
        cacheEnabled && !isCacheUnavailable(),
      );
      notifyUnit();
      requestCacheSync();
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

      const didHydrateFromIdentityCache = hydrateFromIdentityCache();
      if (didHydrateFromIdentityCache && isLatestRun()) {
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
      runContextEntry.context.value = internal.state.value;
      runContextEntry.context.status = internal.state.status;
      runContextEntry.context.meta = internal.state.meta;
      runContextEntry.context.context = internal.state.context;

      const usesSingleInFlight = singleInFlightPromise === null && internal.inFlightByPayload.size === 0;
      const trackedPayloadKey = usesSingleInFlight
        ? null
        : (payloadKey ?? payloadKeyCache.getOrCreateKey(internal.payload));

      activeRunCount += 1;
      const runPromise: Promise<TData> = Promise.resolve(run(runContextEntry.context))
        .then((result) => {
          if (isCleanup(result)) {
            if (!isLatestRun()) {
              invokeCleanup(result);
              return internal.state.value;
            }

            if (internal.destroyed || internal.stopped) {
              invokeCleanup(result);
            } else {
              invokeCleanup(internal.cleanup);
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
          requestCacheSync();

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
          activeRunCount = Math.max(0, activeRunCount - 1);
          flushPendingCacheSync();

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

    const subscribe = (listener: EffectListener<TData, TMeta | null, SourceContext, TIdentity>) => {
      if (internal.destroyed) {
        return undefined;
      }

      internal.listeners.add(listener);

      return () => {
        internal.listeners.delete(listener);
      };
    };
    const fetchUnit: SourceRun<TPayload, TData, TMeta> = (
      input?: SourceRunInput<TPayload, TData, TMeta>,
      config?: SourceRunConfig,
    ) => {
      if (config) {
        runConfig = config;
      }

      let payloadInput: TPayload | undefined;
      if (isUnitSetAction<TPayload, SourceRunConfig, TData, TMeta | null, SourceContext>(input)) {
        const previous: UnitRunPrevious<
          TPayload,
          SourceRunConfig,
          TData,
          TMeta | null,
          SourceContext
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
        return executeRun(true, payloadInput).then(resolveUnitRunAsVoid);
      }
      return executeRun(false, payloadInput).then(resolveUnitRunAsVoid);
    };
    const refetch = (
      input?: SourceFetchInput<TPayload, TData, TMeta>,
    ): Promise<void> => {
      if (input === undefined) {
        return Promise.resolve(
          Reflect.apply(fetchUnit, undefined, [
            undefined,
            { mode: 'refetch' },
          ]),
        );
      }

      return Promise.resolve(
        Reflect.apply(fetchUnit, undefined, [
          input,
          { mode: 'refetch' },
        ]),
      );
    };
    const force = (
      input?: SourceFetchInput<TPayload, TData, TMeta>,
    ): Promise<void> => {
      if (input === undefined) {
        return Promise.resolve(
          Reflect.apply(fetchUnit, undefined, [
            undefined,
            { mode: 'force' },
          ]),
        );
      }

      return Promise.resolve(
        Reflect.apply(fetchUnit, undefined, [
          input,
          { mode: 'force' },
        ]),
      );
    };
    let baseSnapshotCache = snapshotCache;
    let sourceSnapshotCache: SourceSnapshot<TIdentity, TPayload, TData, TMeta> | null = null;
    const resolveSnapshot = (): SourceSnapshot<TIdentity, TPayload, TData, TMeta> => {
      ensureValueFresh();
      const baseSnapshot = (
        snapshotCache.status === internal.state.status
        && Object.is(snapshotCache.value, internal.state.value)
        && Object.is(snapshotCache.meta, internal.state.meta)
        && Object.is(snapshotCache.context, internal.state.context)
      )
        ? snapshotCache
        : readSnapshot();

      if (sourceSnapshotCache && Object.is(baseSnapshotCache, baseSnapshot)) {
        return sourceSnapshotCache;
      }

      baseSnapshotCache = baseSnapshot;
      sourceSnapshotCache = {
        ...baseSnapshot,
        load: fetchUnit,
        refetch,
        force,
      };
      return sourceSnapshotCache;
    };
    const getSnapshot = (): SourceSnapshot<TIdentity, TPayload, TData, TMeta> => {
      return resolveSnapshot();
    };
    const unit: SourceUnit<TIdentity, TPayload, TData, TMeta> = {
      getSnapshot,
      subscribe,
    };

    internal.unit = unit;
    unitsByKey.set(unitKey, internal);

    return unit;
  };

  return sourceFactory;
};

export const source: SourceBuilder = <
  TEntityStore extends Entity<object, EntityId>,
  TMode extends UnitEntityMode,
>({
  entity,
  mode,
}: SourceBuilderInput<TEntityStore, TMode>): SourceByEntityModeBuilder<TEntityStore, TMode> => {
  const sourceByEntityMode: SourceByEntityModeBuilder<TEntityStore, TMode> = <
    TIdentity extends object | undefined,
    TPayload,
    TMeta,
  >(
    config: SourceConfig<
      TIdentity,
      TPayload,
      EntityValueOfStore<TEntityStore>,
      TMode,
      TMeta
    >,
  ) => {
    return createSourceFromConfig({
      entity,
      mode,
    }, config);
  };

  return sourceByEntityMode;
};
