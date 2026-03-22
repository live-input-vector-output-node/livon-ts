import {
  type CacheConfig,
  type CacheStorage,
  type CacheTtl,
  type DraftMode,
  type Entity,
  type EntityId,
  type UpsertOptions,
} from './entity.js';
import {
  createCacheWriteQueue,
  cloneValue,
  createUnitSnapshot,
  notifyEffectListeners,
  resolveInput,
  resolveValue,
  stableSerialize,
  type EffectListener,
  type InputUpdater,
  type ValueUpdater,
} from './utils/index.js';

export interface SourceDestroyContext<TInput, TPayload> {
  scope: TInput;
  payload: TPayload;
}

export interface SourceCleanup {
  (): void;
}

export type SourceRunResult<RResult> = RResult | SourceCleanup | void;

export interface SourceRunContext<
  TInput,
  TPayload,
  TEntity extends object,
  RResult,
  TEntityId extends EntityId = string,
> {
  scope: TInput;
  payload: TPayload;
  setMeta: (meta: unknown) => void;
  upsertOne: (input: TEntity, options?: UpsertOptions) => TEntity;
  upsertMany: (input: readonly TEntity[], options?: UpsertOptions) => readonly TEntity[];
  removeOne: (id: TEntityId) => boolean;
  removeMany: (ids: readonly TEntityId[]) => readonly TEntityId[];
  getValue: () => RResult;
}

export interface SourceConfig<
  TInput extends object | undefined,
  TPayload,
  TEntity extends object,
  RResult,
  UUpdate extends RResult,
  TEntityId extends EntityId = string,
> {
  entity: Entity<TEntity, TEntityId>;
  ttl?: number;
  draft?: DraftMode;
  cache?: CacheConfig;
  destroyDelay?: number;
  onDestroy?: (context: SourceDestroyContext<TInput, TPayload>) => void;
  run: (
    context: SourceRunContext<TInput, TPayload, TEntity, RResult, TEntityId>,
  ) => Promise<SourceRunResult<RResult>> | SourceRunResult<RResult>;
  defaultValue?: RResult;
  update?: (current: RResult, update: UUpdate) => RResult;
}

export interface SourceUnit<
  TInput extends object | undefined,
  TPayload,
  RResult,
  UUpdate extends RResult,
> {
  (payloadInput?: TPayload | InputUpdater<TPayload>): SourceUnit<TInput, TPayload, RResult, UUpdate>;
  ttl: number;
  draft: DraftMode;
  cacheTtl: CacheTtl;
  destroyDelay: number;
  run: (payloadInput?: TPayload | InputUpdater<TPayload>) => Promise<RResult>;
  get: () => RResult;
  set: (input: UUpdate | ValueUpdater<RResult, UUpdate>) => void;
  setDraft: (input: UUpdate | ValueUpdater<RResult, UUpdate>) => void;
  cleanDraft: () => void;
  effect: (listener: EffectListener<RResult>) => (() => void) | void;
  refetch: (
    scopeInput?: TInput | InputUpdater<TInput>,
  ) => (
    payloadInput?: TPayload | InputUpdater<TPayload>,
  ) => Promise<RResult>;
  force: (payloadInput?: TPayload | InputUpdater<TPayload>) => Promise<RResult>;
  stop: () => void;
  destroy: () => void;
}

export interface Source<
  TInput extends object | undefined = object | undefined,
  TPayload = unknown,
  RResult = unknown,
  UUpdate extends RResult = RResult,
> {
  (scope: TInput): SourceUnit<TInput, TPayload, RResult, UUpdate>;
}

export type SourceUnitByKeyMap<
  TInput extends object | undefined,
  TPayload,
  TEntityId extends EntityId,
  RResult,
  UUpdate extends RResult,
> = Map<string, SourceUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>>;

interface SourceUnitState<RResult> {
  value: RResult;
  status: 'idle' | 'loading' | 'success' | 'error';
  meta: unknown;
  context: SourceContext;
}

interface SourceUnitInternal<
  TInput extends object | undefined,
  TPayload,
  TEntityId extends EntityId,
  RResult,
  UUpdate extends RResult,
> {
  key: string;
  ttl: number;
  destroyDelay: number;
  scope: TInput;
  payload: TPayload;
  state: SourceUnitState<RResult>;
  mode: 'raw' | 'one' | 'many';
  membershipIds: readonly TEntityId[];
  listeners: Set<EffectListener<RResult>>;
  inFlight: Promise<RResult> | null;
  inFlightByPayload: Map<string, Promise<RResult>>;
  runSequence: number;
  latestRunSequence: number;
  lastRunAt: number | null;
  cleanup: SourceCleanup | null;
  stopped: boolean;
  destroyed: boolean;
  destroyHandled: boolean;
  unit: SourceUnit<TInput, TPayload, RResult, UUpdate>;
}

const DEFAULT_DESTROY_DELAY = 250;
const DEFAULT_DRAFT_MODE: DraftMode = 'global';
const DEFAULT_CACHE_TTL: CacheTtl = 0;
const DEFAULT_CACHE_KEY_PREFIX = 'livon-sync-source';

interface SourceContext {
  rehydrated: boolean;
  refreshing: boolean;
  cacheState: 'disabled' | 'miss' | 'hit' | 'stale';
  error: unknown;
}

interface SourceCacheRecord<
  TEntity extends object,
  RResult,
> {
  mode: 'raw' | 'one' | 'many';
  value: RResult;
  entities: readonly TEntity[];
  writtenAt: number;
}

interface ResolveCacheTtlInput {
  sourceCache: CacheConfig | undefined;
  entityCache: CacheConfig | undefined;
}

interface ResolveCacheStorageInput {
  sourceCache: CacheConfig | undefined;
  entityCache: CacheConfig | undefined;
}

interface ResolveCacheKeyInput {
  sourceCache: CacheConfig | undefined;
  entityCache: CacheConfig | undefined;
  sourceKey: string;
}

interface IsCacheRecordExpiredInput {
  ttl: CacheTtl;
  writtenAt: number;
}

interface ReadEntityValueById<TId extends EntityId, TEntity extends object> {
  (id: TId): TEntity | undefined;
}

const isEntityValue = <TEntity extends object>(value: unknown): value is TEntity => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isEntityArray = <TEntity extends object>(value: unknown): value is readonly TEntity[] => {
  return Array.isArray(value);
};

const getGlobalStorage = (): CacheStorage | undefined => {
  const maybeStorage = globalThis as { localStorage?: CacheStorage };
  const localStorage = maybeStorage.localStorage;

  if (!localStorage) {
    return undefined;
  }

  if (
    typeof localStorage.getItem !== 'function'
    || typeof localStorage.setItem !== 'function'
    || typeof localStorage.removeItem !== 'function'
  ) {
    return undefined;
  }

  return localStorage;
};

const resolveCacheTtl = ({
  sourceCache,
  entityCache,
}: ResolveCacheTtlInput): CacheTtl => {
  if (sourceCache && sourceCache.ttl !== undefined) {
    return sourceCache.ttl;
  }

  if (entityCache && entityCache.ttl !== undefined) {
    return entityCache.ttl;
  }

  return DEFAULT_CACHE_TTL;
};

const resolveCacheStorage = ({
  sourceCache,
  entityCache,
}: ResolveCacheStorageInput): CacheStorage | undefined => {
  if (sourceCache && sourceCache.storage) {
    return sourceCache.storage;
  }

  if (entityCache && entityCache.storage) {
    return entityCache.storage;
  }

  return getGlobalStorage();
};

const resolveCacheKey = ({
  sourceCache,
  entityCache,
  sourceKey,
}: ResolveCacheKeyInput): string => {
  const sourceKeyPrefix = sourceCache?.key;
  if (sourceKeyPrefix) {
    return `${sourceKeyPrefix}:${sourceKey}`;
  }

  const entityKeyPrefix = entityCache?.key;
  if (entityKeyPrefix) {
    return `${entityKeyPrefix}:${sourceKey}`;
  }

  return `${DEFAULT_CACHE_KEY_PREFIX}:${sourceKey}`;
};

const isCacheRecordExpired = ({
  ttl,
  writtenAt,
}: IsCacheRecordExpiredInput): boolean => {
  if (ttl === 'infinity') {
    return false;
  }

  if (ttl <= 0) {
    return true;
  }

  return Date.now() - writtenAt > ttl;
};

const parseSourceCacheRecord = <TEntity extends object, RResult>(
  value: string | null,
): SourceCacheRecord<TEntity, RResult> | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as SourceCacheRecord<TEntity, RResult>;
    if (!parsed || typeof parsed !== 'object') {
      return undefined;
    }

    if (
      parsed.mode !== 'raw'
      && parsed.mode !== 'one'
      && parsed.mode !== 'many'
    ) {
      return undefined;
    }

    if (!Array.isArray(parsed.entities)) {
      return undefined;
    }

    if (typeof parsed.writtenAt !== 'number') {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
};

const getModeValue = <
  TInput extends object | undefined,
  TPayload,
  TEntityId extends EntityId,
  TEntity extends object,
  RResult,
  UUpdate extends RResult,
>(
  internal: SourceUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>,
  readEntityValueById: ReadEntityValueById<TEntityId, TEntity>,
): RResult => {
  if (internal.mode === 'many') {
    const manyValue = internal.membershipIds
      .map((id) => readEntityValueById(id))
      .filter((entry): entry is TEntity => entry !== undefined);

    return manyValue as RResult;
  }

  if (internal.mode === 'one') {
    const firstId = internal.membershipIds[0];
    const oneValue = firstId ? readEntityValueById(firstId) ?? null : null;

    return oneValue as RResult;
  }

  return internal.state.value;
};

const shouldUseCache = <
  TInput extends object | undefined,
  TPayload,
  TEntityId extends EntityId,
  RResult,
  UUpdate extends RResult,
>(
  internal: SourceUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>,
): boolean => {
  if (internal.ttl <= 0) {
    return false;
  }

  if (internal.lastRunAt === null) {
    return false;
  }

  return Date.now() - internal.lastRunAt < internal.ttl;
};

const invokeSourceCleanup = (
  cleanup: SourceCleanup | null,
): void => {
  if (!cleanup) {
    return;
  }

  try {
    cleanup();
  } catch {
    return;
  }
};

const isSourceCleanup = <RResult>(
  input: SourceRunResult<RResult>,
): input is SourceCleanup => {
  return typeof input === 'function';
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
  update,
}: SourceConfig<TInput, TPayload, TEntity, RResult, UUpdate, TEntityId>,
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
    sourceKey: stableSerialize(run),
  });

  const unitsByKey: SourceUnitByKeyMap<TInput, TPayload, TEntityId, RResult, UUpdate> =
    new Map<string, SourceUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>>();
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
    const key = stableSerialize(scope);
    const existingUnit = unitsByKey.get(key);

    if (existingUnit) {
      return existingUnit.unit;
    }

    const initialValue = (defaultValue ?? null) as RResult;

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
        mode: 'raw',
        membershipIds: [],
      listeners: new Set<EffectListener<RResult>>(),
      inFlight: null,
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

      const setRawMode = (): void => {
        internal.mode = 'raw';
        internal.membershipIds = [];
        entity.clearUnitMembership(internal.key);
      };

      const setOneMode = (value: TEntity): void => {
        const id = entity.idOf(value);
        const membershipIds = [id];

        internal.mode = 'one';
        internal.membershipIds = membershipIds;
        entity.setUnitMembership({
          key: internal.key,
          ids: membershipIds,
        });
      };

      const setManyMode = (value: readonly TEntity[]): void => {
        const membershipIds = value.map((entry) => entity.idOf(entry));

        internal.mode = 'many';
        internal.membershipIds = membershipIds;
        entity.setUnitMembership({
          key: internal.key,
          ids: membershipIds,
        });
      };

      const setContext = (input: Partial<SourceContext>): void => {
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

      const buildCacheRecord = (): SourceCacheRecord<TEntity, RResult> => {
        const entities = internal.membershipIds
          .map((id) => entity.getById(id))
          .filter((entry): entry is TEntity => entry !== undefined);

        return {
          mode: internal.mode,
          value: internal.state.value,
          entities,
          writtenAt: Date.now(),
        };
      };

      const writeCacheRecord = (): void => {
        if (!cacheEnabled || !cacheWriteQueue) {
          return;
        }

        cacheWriteQueue.enqueueSet(unitCacheKey, () => {
          const record = buildCacheRecord();
          return JSON.stringify(record);
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
        const parsedRecord = parseSourceCacheRecord<TEntity, RResult>(rawRecord);
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

        if (parsedRecord.mode === 'raw') {
          setRawMode();
          internal.state.value = parsedRecord.value;
        }

        if (parsedRecord.mode === 'one') {
          const firstEntity = parsedRecord.entities[0];
          if (firstEntity) {
            const upsertedEntity = entity.upsertOne(firstEntity);
            setOneMode(upsertedEntity);
            internal.state.value = getModeValue(internal, readEntityValueById);
          }
        }

        if (parsedRecord.mode === 'many') {
          const upsertedEntities = entity.upsertMany(parsedRecord.entities);
          setManyMode(upsertedEntities);
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
        const payloadKey = stableSerialize(internal.payload);
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
          internal.state.value = getModeValue(internal, readEntityValueById);
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

        const runContext: SourceRunContext<TInput, TPayload, TEntity, RResult, TEntityId> = {
          scope: internal.scope,
          payload: internal.payload,
          setMeta: (meta) => {
            if (!isLatestRun()) {
              return;
            }

            internal.state.meta = meta;
            notifyUnit(internal);
          },
          upsertOne: (input, options) => {
            if (!isLatestRun()) {
              return input;
            }

            const updated = entity.upsertOne(input, options);
            setOneMode(updated);
            internal.state.value = getModeValue(internal, readEntityValueById);
            return updated;
          },
          upsertMany: (input, options) => {
            if (!isLatestRun()) {
              return input;
            }

            const updated = entity.upsertMany(input, options);
            setManyMode(updated);
            internal.state.value = getModeValue(internal, readEntityValueById);
            return updated;
          },
          removeOne: (id) => {
            if (!isLatestRun()) {
              return false;
            }

            const removed = entity.removeOne(id);
            internal.state.value = getModeValue(internal, readEntityValueById);
            return removed;
          },
          removeMany: (ids) => {
            if (!isLatestRun()) {
              return [];
            }

            const removedIds = entity.removeMany(ids);
            internal.state.value = getModeValue(internal, readEntityValueById);
            return removedIds;
          },
          getValue: () => {
            internal.state.value = getModeValue(internal, readEntityValueById);
            return internal.state.value;
          },
        };

        const runPromise: Promise<RResult> = Promise.resolve(run(runContext))
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
            } else if (result !== undefined) {
              setRawMode();
              internal.state.value = result as RResult;
            } else {
              internal.state.value = getModeValue(internal, readEntityValueById);
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
            if (isLatestRun() && internal.inFlight === runPromise) {
              internal.inFlight = null;
            }
            internal.inFlightByPayload.delete(payloadKey);
          });

        internal.inFlight = runPromise;
        internal.inFlightByPayload.set(payloadKey, runPromise);

        return runPromise;
      };

      const unit = ((payloadInput?: TPayload | InputUpdater<TPayload>) => {
        internal.payload = resolveInput(internal.payload, payloadInput);
        return unit;
      }) as SourceUnit<TInput, TPayload, RResult, UUpdate>;

      unit.ttl = ttl;
      unit.draft = draft;
      unit.cacheTtl = cacheTtl;
      unit.destroyDelay = destroyDelay;
      unit.run = (payloadInput) => executeRun(false, payloadInput);
      unit.get = () => {
        internal.state.value = getModeValue(internal, readEntityValueById);
        return internal.state.value;
      };
      unit.set = (input) => {
        if (internal.destroyed) {
          return;
        }

        const nextUpdate = resolveValue(internal.state.value, input);
        const nextValue = update
          ? update(internal.state.value, nextUpdate)
          : nextUpdate;

        setRawMode();
        internal.state.value = nextValue;
        notifyUnit(internal);
        writeCacheRecord();
      };
      unit.setDraft = (input) => {
        if (internal.destroyed || draft === 'off') {
          return;
        }

        const previousValue = getModeValue(internal, readEntityValueById);
        const nextUpdate = resolveValue(cloneValue(previousValue), input);

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
      };
      unit.cleanDraft = () => {
        if (internal.destroyed || draft === 'off') {
          return;
        }

        internal.membershipIds.forEach((id) => {
          clearDraftById(id);
        });
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
      unit.refetch = (scopeInput) => {
        return (payloadInput) => {
          const nextScope = resolveInput(internal.scope, scopeInput);
          const nextPayload = resolveInput(internal.payload, payloadInput);

          return sourceFactory(nextScope).force(nextPayload);
        };
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
        if (internal.destroyed) {
          return;
        }

        internal.runSequence += 1;
        internal.latestRunSequence = internal.runSequence;
        internal.stopped = true;
        invokeSourceCleanup(internal.cleanup);
        internal.cleanup = null;
        internal.destroyed = true;

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

      internal.unit = unit;
      unitsByKey.set(key, internal);

      return unit;
  };

  return sourceFactory;
};
