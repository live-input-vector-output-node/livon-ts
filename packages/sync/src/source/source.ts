import { type DraftMode, type EntityId, type UpsertOptions } from '../entity.js';
import {
  clearEntityMembership,
  createCacheWriteQueue,
  createDependencyCache,
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
  isSourceCleanup,
  readSourceCacheRecord,
  resolveCacheKey,
  resolveCacheStorage,
  resolveCacheTtl,
  serializeSourceCacheRecord,
  shouldUseCache,
} from './helpers.js';
import type {
  ReadEntityValueById,
  Source,
  SourceCacheRecord,
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
  const cacheStorage = resolveCacheStorage({
    sourceCache: cache,
    entityCache: entity.cache,
  });
  const cacheWriteQueue = cacheStorage
    ? createCacheWriteQueue({ storage: cacheStorage })
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
  const runContextCache = createDependencyCache<
    SourceRunContextEntry<TInput, TPayload, TEntity, RResult, TEntityId>
  >({
    limit: RUN_CONTEXT_CACHE_LIMIT,
  });
  const scopedDraftsById = new Map<TEntityId, TEntity>();

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
    const key = serializeKey(scope);
    const existingUnit = unitsByKey.get(key);

    if (existingUnit) {
      return existingUnit.unit;
    }

    const initialValue = (defaultValue ?? null) as RResult;
    const initialMode: 'one' | 'many' = Array.isArray(initialValue) ? 'many' : 'one';

    const internal: SourceUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate> = {
      key,
      ttl,
      destroyDelay,
      scope,
      payload: undefined as TPayload,
      state: {
        value: initialValue,
        status: 'idle',
        meta: null,
        context: {
          rehydrated: false,
          refreshing: false,
          cacheState: cacheStorage ? 'miss' : 'disabled',
          error: null,
        },
      },
      mode: initialMode,
      hasEntityValue: false,
      membershipIds: [],
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
      const createRunContextEntry = (
        payload: TPayload,
      ): SourceRunContextEntry<TInput, TPayload, TEntity, RResult, TEntityId> => {
        const gate: SourceRunGate = {
          isLatestRun: () => false,
        };
        const upsertOne = (input: TEntity, options?: UpsertOptions): TEntity => {
          if (!gate.isLatestRun()) {
            return input;
          }

          const updated = entity.upsertOne(input, options);
          setOneEntityMembership(internal, { entity, value: updated });
          internal.state.value = getModeValue(internal, readEntityValueById);
          return updated;
        };
        const upsertMany = (
          input: readonly TEntity[],
          options?: UpsertOptions,
        ): readonly TEntity[] => {
          if (!gate.isLatestRun()) {
            return input;
          }

          const updated = entity.upsertMany(input, options);
          setManyEntityMembership(internal, { entity, values: updated });
          internal.state.value = getModeValue(internal, readEntityValueById);
          return updated;
        };
        const removeOne = (id: TEntityId): boolean => {
          if (!gate.isLatestRun()) {
            return false;
          }

          const removed = entity.removeOne(id);
          internal.state.value = getModeValue(internal, readEntityValueById);
          return removed;
        };
        const removeMany = (ids: readonly TEntityId[]): readonly TEntityId[] => {
          if (!gate.isLatestRun()) {
            return [];
          }

          const removedIds = entity.removeMany(ids);
          internal.state.value = getModeValue(internal, readEntityValueById);
          return removedIds;
        };
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
          upsertOne,
          upsertMany,
          removeOne,
          removeMany,
          getValue: () => {
            return internal.state.value;
          },
        };

        return {
          gate,
          context: runContextBase,
        };
      };

      const setContext = (input: Partial<SourceContext>): void => {
        const hasRehydrated = Object.prototype.hasOwnProperty.call(input, 'rehydrated');
        const hasRefreshing = Object.prototype.hasOwnProperty.call(input, 'refreshing');
        const hasCacheState = Object.prototype.hasOwnProperty.call(input, 'cacheState');
        const hasError = Object.prototype.hasOwnProperty.call(input, 'error');

        if (
          (!hasRehydrated || input.rehydrated === internal.state.context.rehydrated)
          && (!hasRefreshing || input.refreshing === internal.state.context.refreshing)
          && (!hasCacheState || input.cacheState === internal.state.context.cacheState)
          && (!hasError || Object.is(input.error, internal.state.context.error))
        ) {
          return;
        }

        internal.state.context = {
          ...internal.state.context,
          ...input,
        };
      };

      const unitCacheKey = `${cacheKeyPrefix}:${key}`;
      const cacheEnabled = Boolean(
        cacheStorage
        && (cacheTtl === 'infinity' || cacheTtl > 0),
      );

      const buildCacheRecord = (): SourceCacheRecord<TEntity> => {
        const entities = internal.membershipIds
          .map((id) => entity.getById(id))
          .filter((entry): entry is TEntity => entry !== undefined);

        return {
          mode: internal.mode,
          entities,
          writtenAt: Date.now(),
        };
      };

      const writeCacheRecord = (): void => {
        if (!cacheEnabled || !cacheWriteQueue || !internal.hasEntityValue) {
          return;
        }

        cacheWriteQueue.enqueueSet(unitCacheKey, () => {
          const record = buildCacheRecord();
          return serializeSourceCacheRecord(record);
        });
      };

      const hydrateFromCache = (): void => {
        if (!cacheStorage) {
          setContext({
            cacheState: 'disabled',
          });
          return;
        }

        if (!cacheEnabled) {
          setContext({
            cacheState: 'disabled',
          });
          return;
        }

        const rawRecord = cacheStorage.getItem(unitCacheKey);
        const parsedRecord = readSourceCacheRecord<TEntity>(rawRecord);
        if (!parsedRecord) {
          setContext({
            cacheState: 'miss',
          });
          return;
        }

        if (isCacheRecordExpired({ ttl: cacheTtl, writtenAt: parsedRecord.writtenAt })) {
          cacheWriteQueue?.enqueueRemove(unitCacheKey);
          setContext({
            cacheState: 'stale',
          });
          return;
        }

          if (parsedRecord.mode === 'one') {
          const firstEntity = parsedRecord.entities[0];
          internal.hasEntityValue = true;

          if (firstEntity) {
            const upsertedEntity = entity.upsertOne(firstEntity);
            setOneEntityMembership(internal, { entity, value: upsertedEntity });
            internal.state.value = getModeValue(internal, readEntityValueById);
          } else {
            clearEntityMembership(internal, { clearUnitMembership: entity.clearUnitMembership });
            internal.state.value = getModeValue(internal, readEntityValueById);
          }
        }

        if (parsedRecord.mode === 'many') {
          const upsertedEntities = entity.upsertMany(parsedRecord.entities);
          setManyEntityMembership(internal, { entity, values: upsertedEntities });
          internal.state.value = getModeValue(internal, readEntityValueById);
        }

        internal.state.status = 'success';
        setContext({
          rehydrated: true,
          cacheState: 'hit',
          error: null,
        });
      };

      const unregisterFromEntity = entity.registerUnit({
        key: internal.key,
        onChange: () => {
          if (internal.destroyed) {
            return;
          }

          notifyUnit(internal);
          writeCacheRecord();
        },
      });

      hydrateFromCache();

      const destroyInternal = (): void => {
        if (internal.destroyed) {
          return;
        }

        internal.runSequence += 1;
        internal.latestRunSequence = internal.runSequence;
        internal.stopped = true;
        invokeSourceCleanup(internal.cleanup);
        internal.cleanup = null;
        internal.destroyed = true;
        runContextCache.clearPrimary({
          primaryDependencies: [internal.key],
        });

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
        const payloadKey = serializeKey(internal.payload);
        const inFlightForPayload = internal.inFlightByPayload.get(payloadKey);
        if (inFlightForPayload) {
          return inFlightForPayload;
        }

        internal.stopped = false;
        internal.runSequence += 1;
        internal.latestRunSequence = internal.runSequence;
        const runSequence = internal.runSequence;
        const isLatestRun = () => {
          return internal.latestRunSequence === runSequence && !internal.destroyed;
        };

        if (!isForce && !hasPayloadInput && shouldUseCache(internal)) {
          return Promise.resolve(internal.state.value);
        }

        const shouldRunSilentRefresh = internal.state.context.rehydrated && internal.lastRunAt === null;
        if (!shouldRunSilentRefresh && isLatestRun()) {
          internal.state.status = 'loading';
        }
        if (isLatestRun()) {
          setContext({
            refreshing: shouldRunSilentRefresh,
            error: null,
          });
          notifyUnit(internal);
        }

        const applyRunValue = (nextValue: RResult | void): void => {
          if (!isLatestRun()) {
            return;
          }

          if (nextValue === undefined) {
            internal.state.value = getModeValue(internal, readEntityValueById);
            return;
          }

          if (isEntityArray<TEntity>(nextValue)) {
            const upsertedEntities = entity.upsertMany(nextValue);
            setManyEntityMembership(internal, { entity, values: upsertedEntities });
            internal.state.value = getModeValue(internal, readEntityValueById);
            return;
          }

          if (isEntityValue<TEntity>(nextValue)) {
            const upsertedEntity = entity.upsertOne(nextValue);
            setOneEntityMembership(internal, { entity, value: upsertedEntity });
            internal.state.value = getModeValue(internal, readEntityValueById);
            return;
          }

          clearEntityMembership(internal, { clearUnitMembership: entity.clearUnitMembership });
          internal.state.value = nextValue;
        };

        const runContextEntry = runContextCache.getOrCreate({
          primaryDependencies: [internal.key],
          secondaryDependencies: [payloadKey],
          build: () => {
            return createRunContextEntry(internal.payload);
          },
        });
        runContextEntry.gate.isLatestRun = isLatestRun;
        runContextEntry.context.payload = internal.payload;

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
              rehydrated: false,
              refreshing: false,
              error: null,
            });
            notifyUnit(internal);
            writeCacheRecord();

            return internal.state.value;
          })
          .catch((error: unknown) => {
            if (isLatestRun()) {
              internal.state.status = 'error';
              setContext({
                refreshing: false,
                error,
              });
              notifyUnit(internal);
            }

            throw error;
          })
          .finally(() => {
            internal.inFlightByPayload.delete(payloadKey);
          });

        internal.inFlightByPayload.set(payloadKey, runPromise);

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
      unit.stop = () => {
        if (internal.destroyed) {
          return;
        }

        internal.runSequence += 1;
        internal.latestRunSequence = internal.runSequence;
        internal.stopped = true;
        invokeSourceCleanup(internal.cleanup);
        internal.cleanup = null;
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
