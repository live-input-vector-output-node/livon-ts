import { type DraftMode, type EntityId } from '../entity.js';
import {
  applyEntityRunResult,
  clearEntityMembership,
  createEntityRunContextMethods,
  createRunContextEntryCache,
  readOrCreateSharedCacheWriteQueue,
  createSerializedKeyCache,
  cloneValue,
  createUnitSnapshot,
  notifyEffectListeners,
  resolveInput,
  resolveValue,
  setManyEntityMembership,
  setOneEntityMembership,
  serializeKey,
  type EffectListener,
  type InputUpdater,
  type ValueUpdater,
} from '../utils/index.js';

import {
  areDraftValuesEqual,
  getModeValue,
  invokeSourceCleanup,
  isCacheRecordExpired,
  isEntityArray,
  isEntityValue,
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
  SourceRunContext,
  SourceRunContextEntry,
  SourceRunGate,
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

export const source = <
  TInput extends object | undefined,
  TPayload = unknown,
  TEntity extends object = object,
  RResult = unknown,
  UUpdate extends RResult = RResult,
  TEntityId extends EntityId = string,
>({
  entity,
  ttl = entity.ttl ?? 0,
  draft = entity.draft ?? DEFAULT_DRAFT_MODE,
  cache,
  destroyDelay = entity.destroyDelay ?? DEFAULT_DESTROY_DELAY,
  onDestroy,
  run,
  defaultValue,
}: SourceConfig<TInput, TPayload, TEntity, RResult, TEntityId>,
): Source<TInput, TPayload, RResult, UUpdate> => {
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

  const unitsByKey: SourceUnitByKeyMap<TInput, TPayload, TEntityId, RResult, UUpdate> =
    new Map<string, SourceUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>>();
  const scopedDraftsById = new Map<TEntityId, TEntity>();
  const unitKeyCache = createSerializedKeyCache({
    mode: 'scoped-unit',
  });

  const notifyScopedUnitsById = (id: TEntityId): void => {
    Array.from(unitsByKey.values()).forEach((unitInternal) => {
      const hasMembership = unitInternal.membershipIds.some((membershipId) => membershipId === id);
      if (!hasMembership) {
        return;
      }

      notifyUnit(unitInternal);
    });
  };

  const readEntityValueById: ReadEntityValueById<TEntityId, TEntity> = (id) => {
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

    const scopedDraft = scopedDraftsById.get(id);
    if (scopedDraft) {
      return scopedDraft;
    }

    return entity.getById(id);
  };

  const setDraftById = (id: TEntityId, value: TEntity): void => {
    if (draft === 'off') {
      return;
    }

    if (draft === 'global') {
      entity.setDraftById(id, value);
      return;
    }

    scopedDraftsById.set(id, value);
    notifyScopedUnitsById(id);
  };

  const clearDraftById = (id: TEntityId): void => {
    if (draft === 'off') {
      return;
    }

    if (draft === 'global') {
      entity.clearDraftById(id);
      return;
    }

    const existed = scopedDraftsById.delete(id);
    if (!existed) {
      return;
    }

    notifyScopedUnitsById(id);
  };

  const notifyUnit = (
    internal: SourceUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>,
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

  const sourceFactory: Source<TInput, TPayload, RResult, UUpdate> = (scope) => {
    const key = unitKeyCache.getOrCreateKey(scope);
    const existingUnit = unitsByKey.get(key);

    if (existingUnit) {
      return existingUnit.unit;
    }

    const initialValue = (defaultValue ?? null) as RResult;
    const initialPayload = undefined as TPayload;
    const initialMode: 'one' | 'many' = Array.isArray(initialValue) ? 'many' : 'one';

    const internal: SourceUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate> = {
      key,
      ttl,
      destroyDelay,
      scope,
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
      listeners: new Set<EffectListener<RResult>>(),
      inFlightByPayload: new Map<string, Promise<RResult>>(),
      runSequence: 0,
      latestRunSequence: 0,
      lastRunAt: null,
      cleanup: null,
      stopped: false,
      destroyed: false,
      destroyHandled: false,
      unit: {} as SourceUnit<TInput, TPayload, RResult, UUpdate>,
    };
    const payloadKeyCache = createSerializedKeyCache({
      mode: 'payload-hot-path',
      limit: RUN_CONTEXT_CACHE_LIMIT,
    });
    const createRunContextEntry = (
      payload: TPayload,
    ): SourceRunContextEntry<TInput, TPayload, TEntity, RResult, TEntityId> => {
      const gate: SourceRunGate = {
        isLatestRun: () => false,
      };
      const runContextMethods = createEntityRunContextMethods<
        TEntity,
        RResult,
        TEntityId
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
        TInput,
        TPayload,
        TEntity,
        RResult,
        TEntityId
      > = {
        scope: internal.scope,
        payload,
        setMeta: (metaInput: unknown) => {
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
      SourceRunContextEntry<TInput, TPayload, TEntity, RResult, TEntityId>
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
          .filter((entry): entry is TEntity => entry !== undefined);

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
      const parsedRecord = readSourceCacheRecord<TEntity>(rawRecord);
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

    const unregisterFromEntity = entity.registerUnit({
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

    let singleInFlightPromise: Promise<RResult> | null = null;
    let hasSingleInFlightPayload = false;
    let singleInFlightPayload: TPayload | undefined;
    let singleInFlightPayloadKey: string | null = null;

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

      const previousMembershipIds = internal.membershipIds;
      stopInternal();
      clearInFlightTracking();
      runContextEntryCache.clear();
      payloadKeyCache.clear();
      activePayloadCacheKey = null;
      internal.payload = initialPayload;

      if (draft === 'scoped') {
        previousMembershipIds.forEach((id) => {
          scopedDraftsById.delete(id);
        });
      }

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

    const destroyInternal = (): void => {
      if (internal.destroyed) {
        return;
      }

      stopInternal();
      internal.destroyed = true;
      runContextEntryCache.clear();
      payloadKeyCache.clear();
      activePayloadCacheKey = null;
      clearInFlightTracking();

      unregisterFromEntity();
      internal.listeners.clear();

      if (!internal.destroyHandled) {
        internal.destroyHandled = true;
        onDestroy?.({
          scope: internal.scope,
          payload: internal.payload,
        });
      }

      unitsByKey.delete(internal.key);
    };

    const executeRun = (
      isForce: boolean,
      payloadInput?: TPayload | InputUpdater<TPayload>,
    ): Promise<RResult> => {
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

      const applyRunValue = (nextValue: RResult | void): void => {
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

      const runPromise: Promise<RResult> = Promise.resolve(run(runContextEntry.context))
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

    const unit = ((payloadInput?: TPayload | InputUpdater<TPayload>) => {
      internal.payload = resolveInput(internal.payload, payloadInput);
      return unit;
    }) as SourceUnit<TInput, TPayload, RResult, UUpdate>;

    unit.ttl = ttl;
    unit.cacheTtl = cacheTtl;
    unit.destroyDelay = destroyDelay;
    unit.run = (payloadInput) => executeRun(false, payloadInput);
    unit.get = () => {
      return internal.state.value;
    };
    unit.draft = {
      set: (input: UUpdate | ValueUpdater<RResult, UUpdate>) => {
        if (internal.destroyed || draft === 'off') {
          return;
        }

        const previousValue: RResult = getModeValue(internal, readEntityValueById);
        const draftSeed: RResult = cloneValue(previousValue);
        const nextUpdate = resolveValue(draftSeed, input);

        if (Object.is(nextUpdate, previousValue)) {
          return;
        }

        if (areDraftValuesEqual(previousValue, nextUpdate)) {
          return;
        }

        if (internal.mode === 'one') {
          const firstId = internal.membershipIds[0];
          if (!firstId || !isEntityValue<TEntity>(nextUpdate)) {
            return;
          }

          setDraftById(firstId, cloneValue(nextUpdate));
          return;
        }

        if (internal.mode === 'many') {
          if (!isEntityArray<TEntity>(nextUpdate)) {
            return;
          }

          nextUpdate.forEach((entry) => {
            const entryId = entity.idOf(entry);
            setDraftById(entryId, cloneValue(entry));
          });
        }
      },
      clean: () => {
        if (internal.destroyed || draft === 'off') {
          return;
        }

        internal.membershipIds.forEach((id) => {
          clearDraftById(id);
        });
      },
    };
    unit.effect = (listener) => {
      if (internal.destroyed) {
        return undefined;
      }

      internal.listeners.add(listener);

      return () => {
        internal.listeners.delete(listener);
      };
    };
    unit.refetch = (payloadInput) => {
      const nextPayload = resolveInput(internal.payload, payloadInput);
      return sourceFactory(internal.scope).force(nextPayload);
    };
    unit.force = (payloadInput) => executeRun(true, payloadInput);
    unit.reset = () => {
      resetState();
    };
    unit.stop = () => {
      if (internal.destroyed) {
        return;
      }

      stopInternal();
    };
    unit.destroy = () => {
      destroyInternal();
    };

    Object.defineProperty(unit, 'getSnapshot', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: () => {
        return createUnitSnapshot({
          value: internal.state.value,
          status: internal.state.status,
          meta: internal.state.meta,
          context: internal.state.context,
        });
      },
    });

    internal.unit = unit;
    unitsByKey.set(key, internal);

    return unit;
  };

  return sourceFactory;
};
