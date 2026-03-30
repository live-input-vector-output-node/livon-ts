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
  invokeSourceCleanup,
  isCacheRecordExpired,
  isRecordValue,
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

interface ResolveSourceRunInputInput<
  TPayload,
  TData,
  TMeta,
> {
  input: SourceRunInput<TPayload, TData, TMeta> | undefined;
  config: SourceRunConfig | undefined;
  previous: UnitRunPrevious<TPayload, SourceRunConfig, TData, TMeta | null>;
}

const resolveSourceRunInput = <
  TPayload,
  TData,
  TMeta,
>(
  {
    input,
    config,
    previous,
  }: ResolveSourceRunInputInput<TPayload, TData, TMeta>,
): TPayload | undefined => {
  if (isSourceSetAction<TPayload, TData, TMeta>(input)) {
    return input(previous, config);
  }

  return input;
};

export const source = <
  TIdentity extends object | undefined,
  TPayload = unknown,
  TData = unknown,
  TMeta = unknown,
>({
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
  const cacheStorage = resolveCacheStorage({
    sourceCache: cache,
    entityCache: entity.cache,
  });
  const cacheWriteQueue = cacheStorage
    ? readOrCreateSharedCacheWriteQueue({ storage: cacheStorage })
    : undefined;
  const cacheKeyPrefix = resolveCacheKey({
    sourceCache: cache,
    entityCache: entity.cache,
    sourceKey: serializeKey({
      mode: Array.isArray(defaultValue ?? null) ? 'many' : 'one',
    }),
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

  const notifyUnit = (
    internal: SourceUnitInternal<TIdentity, TPayload, TData, TMeta>,
  ): void => {
    internal.state.value = getModeValue(internal, readEntityValueById);

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

  const sourceFactory: Source<TIdentity, TPayload, TData, TMeta> = (identity) => {
    const key = unitKeyCache.getOrCreateKey(identity);
    const existingUnit = unitsByKey.get(key);

    if (existingUnit) {
      return existingUnit.unit;
    }

    const initialValue = (defaultValue ?? null) as TData;
    const initialPayload = undefined as TPayload;
    const initialMode: 'one' | 'many' = Array.isArray(initialValue) ? 'many' : 'one';

    const internal: SourceUnitInternal<TIdentity, TPayload, TData, TMeta> = {
      key,
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
        refreshValue: () => {
          internal.state.value = getModeValue(internal, readEntityValueById);
        },
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
          notifyUnit(internal);
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
            refreshValueFromMembership: () => {
              internal.state.value = getModeValue(internal, readEntityValueById);
            },
            setRawValue: (value) => {
              internal.state.value = value;
            },
            upsertOneOperation: 'runContext.set() object',
            upsertManyOperation: 'runContext.set() array',
          });

          if (!gate.isLatestRun()) {
            return;
          }

          notifyUnit(internal);
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
    const cacheLruEnabled = Boolean(
      cacheEnabled
      && cacheLruMaxEntries > 0
      && cacheStorage
      && cacheWriteQueue,
    );
    const cacheLruStorageKey = `${cacheKeyPrefix}:${SOURCE_CACHE_LRU_STORAGE_KEY_SUFFIX}`;
    let cacheLruLoaded = false;
    let cacheLruKeys: string[] = [];
    let activePayloadCacheKey: string | null = null;

    const loadCacheLruState = (): void => {
      if (!cacheLruEnabled || cacheLruLoaded || !cacheStorage) {
        return;
      }

      cacheLruLoaded = true;
      const rawLruState = cacheStorage.getItem(cacheLruStorageKey);
      if (!rawLruState) {
        return;
      }

      try {
        const parsedLruState: unknown = JSON.parse(rawLruState);
        if (!isRecordValue(parsedLruState)) {
          return;
        }

        const keysCandidate = parsedLruState.keys;
        if (!Array.isArray(keysCandidate)) {
          return;
        }

        if (!keysCandidate.every((entry) => typeof entry === 'string')) {
          return;
        }

        cacheLruKeys = keysCandidate;
      } catch {
        return;
      }
    };

    const persistCacheLruState = (): void => {
      if (!cacheLruEnabled || !cacheWriteQueue) {
        return;
      }

      if (cacheLruKeys.length === 0) {
        cacheWriteQueue.enqueueRemove(cacheLruStorageKey);
        return;
      }

      cacheWriteQueue.enqueueSet(
        cacheLruStorageKey,
        () => {
          return JSON.stringify({
            keys: cacheLruKeys,
          });
        },
      );
    };

    const touchCacheLruKey = (unitCacheKey: string): void => {
      if (!cacheLruEnabled || !cacheWriteQueue) {
        return;
      }

      loadCacheLruState();
      if (cacheLruKeys[0] === unitCacheKey) {
        return;
      }

      const existingIndex = cacheLruKeys.findIndex((entry) => entry === unitCacheKey);
      if (existingIndex > 0) {
        const existingEntry = cacheLruKeys[existingIndex];
        if (existingEntry === undefined) {
          return;
        }

        cacheLruKeys.splice(existingIndex, 1);
        cacheLruKeys.unshift(existingEntry);
        persistCacheLruState();
        return;
      }

      cacheLruKeys.unshift(unitCacheKey);
      const evictedEntry = cacheLruKeys.length > cacheLruMaxEntries
        ? cacheLruKeys.pop()
        : undefined;
      if (evictedEntry && evictedEntry !== unitCacheKey) {
        cacheWriteQueue.enqueueRemove(evictedEntry);
      }

      persistCacheLruState();
    };

    const removeCacheLruKey = (unitCacheKey: string): void => {
      if (!cacheLruEnabled) {
        return;
      }

      loadCacheLruState();
      const existingIndex = cacheLruKeys.findIndex((entry) => entry === unitCacheKey);
      if (existingIndex < 0) {
        return;
      }

      cacheLruKeys.splice(existingIndex, 1);
      persistCacheLruState();
    };

    const resolvePayloadCacheKey = (payload: TPayload): string => {
      return payloadKeyCache.getOrCreateKey(payload);
    };

    const resolveUnitCacheKey = (payloadCacheKey: string): string => {
      return `${cacheKeyPrefix}:${key}:${payloadCacheKey}`;
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

        return serializeSourceCacheRecord({
          mode: internal.mode,
          entities,
          writtenAt: Date.now(),
        });
      });
    };

    const hydrateFromCache = (payloadCacheKey: string): boolean => {
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

      const unitCacheKey = resolveUnitCacheKey(payloadCacheKey);
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
          internal.state.value = getModeValue(internal, readEntityValueById);
        } else {
          clearEntityMembership(internal, { clearUnitMembership: entity.clearUnitMembership });
          internal.state.value = getModeValue(internal, readEntityValueById);
        }
      }

      if (parsedRecord.mode === 'many') {
        const upsertedEntities = entity.upsertMany(parsedRecord.entities);
        setManyEntityMembership(internal, {
          entity,
          values: upsertedEntities,
          operation: 'cache rehydrate many',
        });
        internal.state.value = getModeValue(internal, readEntityValueById);
      }

      internal.state.status = 'rehydrated';
      setContext({
        cacheState: 'hit',
        error: null,
      });
      return true;
    };

    const hydrateFromPayloadCache = (payload: TPayload): boolean => {
      const payloadCacheKey = resolvePayloadCacheKey(payload);
      if (activePayloadCacheKey === payloadCacheKey) {
        return false;
      }

      activePayloadCacheKey = payloadCacheKey;
      return hydrateFromCache(payloadCacheKey);
    };

    entity.registerUnit({
      key: internal.key,
      onChange: () => {
        if (internal.destroyed) {
          return;
        }

        notifyUnit(internal);
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
      notifyUnit(internal);
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
        notifyUnit(internal);
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
        notifyUnit(internal);
      }

      const applyRunValue = (nextValue: TData | void): void => {
        if (!isLatestRun()) {
          return;
        }

        applyEntityRunResult({
          entity,
          state: internal,
          nextValue,
          refreshValueFromMembership: () => {
            internal.state.value = getModeValue(internal, readEntityValueById);
          },
          setRawValue: (value) => {
            internal.state.value = value;
          },
        });
      };

      const runContextEntry = runContextEntryCache.getOrCreate(internal.payload);
      runContextEntry.gate.isLatestRun = isLatestRun;
      runContextEntry.context.payload = internal.payload;

      const usesSingleInFlight = singleInFlightPromise === null && internal.inFlightByPayload.size === 0;
      const trackedPayloadKey = usesSingleInFlight
        ? null
        : (payloadKey ?? payloadKeyCache.getOrCreateKey(internal.payload));

      const runPromise: Promise<TData> = Promise.resolve(run(runContextEntry.context))
        .then((result) => {
          if (!isLatestRun() && isSourceCleanup(result)) {
            invokeSourceCleanup(result);
            return internal.state.value;
          }

          if (!isLatestRun()) {
            return internal.state.value;
          }

          if (isSourceCleanup(result)) {
            if (internal.destroyed || internal.stopped) {
              invokeSourceCleanup(result);
            } else {
              invokeSourceCleanup(internal.cleanup);
              internal.cleanup = result;
            }

            internal.state.value = getModeValue(internal, readEntityValueById);
          } else {
            applyRunValue(result);
          }

          internal.lastRunAt = Date.now();
          internal.state.status = 'success';
          setContext({
            error: null,
          });
          notifyUnit(internal);
          syncCacheRecord();

          return internal.state.value;
        })
        .catch((error: unknown) => {
          if (isLatestRun()) {
            internal.state.status = 'error';
            setContext({
              error,
            });
            notifyUnit(internal);
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
        const payloadInput = resolveSourceRunInput<
          TPayload,
          TData,
          TMeta
        >({
          input,
          config,
          previous,
        });
        if (config?.mode === 'force' || config?.mode === 'refetch') {
          return executeRun(true, payloadInput).then(() => undefined);
        }
        return executeRun(false, payloadInput).then(() => undefined);
      };
    const unit: SourceUnit<TIdentity, TPayload, TData, TMeta> = {
      identity: internal.identity,
      run: runUnit,
      getSnapshot,
      subscribe,
    };

    internal.unit = unit;
    unitsByKey.set(key, internal);

    return unit;
  };

  return sourceFactory;
};
