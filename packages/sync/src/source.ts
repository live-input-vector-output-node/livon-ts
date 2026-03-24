import { Packr } from 'msgpackr';

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
  decodeBase64,
  deserializeStructuredValue,
  encodeBase64,
  notifyEffectListeners,
  resolveInput,
  resolveValue,
  serializeStructuredValue,
  serializeKey,
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
}

export interface SourceDraftApi<RResult, UUpdate extends RResult> {
  set: (input: UUpdate | ValueUpdater<RResult, UUpdate>) => void;
  clean: () => void;
}

export interface SourceUnit<
  TInput extends object | undefined,
  TPayload,
  RResult,
  UUpdate extends RResult,
> {
  (payloadInput?: TPayload | InputUpdater<TPayload>): SourceUnit<TInput, TPayload, RResult, UUpdate>;
  ttl: number;
  cacheTtl: CacheTtl;
  destroyDelay: number;
  run: (payloadInput?: TPayload | InputUpdater<TPayload>) => Promise<RResult>;
  get: () => RResult;
  draft: SourceDraftApi<RResult, UUpdate>;
  effect: (listener: EffectListener<RResult>) => (() => void) | void;
  refetch: (payloadInput?: TPayload | InputUpdater<TPayload>) => Promise<RResult>;
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
  mode: 'one' | 'many';
  hasEntityValue: boolean;
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
const SOURCE_CACHE_MSGPACK_PREFIX = 'm1:';
const SOURCE_CACHE_STRUCTURED_PREFIX = 's1:';
const sourceCachePackr = new Packr({
  structuredClone: true,
  moreTypes: true,
});

interface SourceContext {
  rehydrated: boolean;
  refreshing: boolean;
  cacheState: 'disabled' | 'miss' | 'hit' | 'stale';
  error: unknown;
}

interface SourceCacheRecord<
  TEntity extends object,
> {
  mode: 'one' | 'many';
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

const serializeSourceCacheRecord = <TEntity extends object>(
  record: SourceCacheRecord<TEntity>,
): string => {
  try {
    const packed = sourceCachePackr.pack(record);
    return `${SOURCE_CACHE_MSGPACK_PREFIX}${encodeBase64(packed)}`;
  } catch {
    const structured = serializeStructuredValue({
      input: record,
    });
    return `${SOURCE_CACHE_STRUCTURED_PREFIX}${structured}`;
  }
};

const deserializeSourceCacheRecord = <TEntity extends object>(
  value: string,
): SourceCacheRecord<TEntity> | undefined => {
  try {
    if (value.startsWith(SOURCE_CACHE_MSGPACK_PREFIX)) {
      const base64Payload = value.slice(SOURCE_CACHE_MSGPACK_PREFIX.length);
      const decoded = sourceCachePackr.unpack(decodeBase64(base64Payload));
      if (decoded && typeof decoded === 'object') {
        return decoded as SourceCacheRecord<TEntity>;
      }
      return undefined;
    }

    if (value.startsWith(SOURCE_CACHE_STRUCTURED_PREFIX)) {
      const structuredPayload = value.slice(SOURCE_CACHE_STRUCTURED_PREFIX.length);
      return deserializeStructuredValue<SourceCacheRecord<TEntity>>(structuredPayload);
    }

    return deserializeStructuredValue<SourceCacheRecord<TEntity>>(value);
  } catch {
    return undefined;
  }
};

const isEntityValue = <TEntity extends object>(value: unknown): value is TEntity => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isEntityArray = <TEntity extends object>(value: unknown): value is readonly TEntity[] => {
  return Array.isArray(value) && value.every((entry) => isEntityValue<TEntity>(entry));
};

const resolveGlobalStorage = (): CacheStorage | undefined => {
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

const globalStorage = resolveGlobalStorage();

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

  return globalStorage;
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

const readSourceCacheRecord = <TEntity extends object>(
  value: string | null,
): SourceCacheRecord<TEntity> | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = deserializeSourceCacheRecord<TEntity>(value);
  if (!parsed || typeof parsed !== 'object') {
    return undefined;
  }

  if (parsed.mode !== 'one' && parsed.mode !== 'many') {
    return undefined;
  }

  if (!Array.isArray(parsed.entities)) {
    return undefined;
  }

  if (typeof parsed.writtenAt !== 'number') {
    return undefined;
  }

  return parsed;
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
  if (!internal.hasEntityValue) {
    return internal.state.value;
  }

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

const isRecordValue = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const areDraftValuesEqual = (
  left: unknown,
  right: unknown,
): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }

    return left.every((leftEntry, index) => {
      const rightEntry = right[index];
      return areDraftValuesEqual(leftEntry, rightEntry);
    });
  }

  if (!isRecordValue(left) || !isRecordValue(right)) {
    return false;
  }

  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);

  return Array.from(keys).every((key) => {
    const hasLeftKey = Object.prototype.hasOwnProperty.call(left, key);
    const hasRightKey = Object.prototype.hasOwnProperty.call(right, key);
    if (hasLeftKey !== hasRightKey) {
      return false;
    }

    const leftValue = left[key];
    const rightValue = right[key];
    if (Object.is(leftValue, rightValue)) {
      return true;
    }

    return serializeKey(leftValue) === serializeKey(rightValue);
  });
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

      const setOneMode = (value: TEntity): void => {
        const id = entity.idOf(value);
        const membershipIds = [id];

        internal.mode = 'one';
        internal.hasEntityValue = true;
        internal.membershipIds = membershipIds;
        entity.setUnitMembership({
          key: internal.key,
          ids: membershipIds,
        });
      };

      const setManyMode = (value: readonly TEntity[]): void => {
        const membershipIds = value.map((entry) => entity.idOf(entry));

        internal.mode = 'many';
        internal.hasEntityValue = true;
        internal.membershipIds = membershipIds;
        entity.setUnitMembership({
          key: internal.key,
          ids: membershipIds,
        });
      };

      const clearEntityMode = (): void => {
        internal.hasEntityValue = false;
        internal.membershipIds = [];
        entity.clearUnitMembership(internal.key);
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
            setOneMode(upsertedEntity);
            internal.state.value = getModeValue(internal, readEntityValueById);
          } else {
            internal.membershipIds = [];
            entity.clearUnitMembership(internal.key);
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
            setManyMode(upsertedEntities);
            internal.state.value = getModeValue(internal, readEntityValueById);
            return;
          }

          if (isEntityValue<TEntity>(nextValue)) {
            const upsertedEntity = entity.upsertOne(nextValue);
            setOneMode(upsertedEntity);
            internal.state.value = getModeValue(internal, readEntityValueById);
            return;
          }

          clearEntityMode();
          internal.state.value = nextValue;
        };

        const upsertOne = (input: TEntity, options?: UpsertOptions): TEntity => {
          if (!isLatestRun()) {
            return input;
          }

          const updated = entity.upsertOne(input, options);
          setOneMode(updated);
          internal.state.value = getModeValue(internal, readEntityValueById);
          return updated;
        };

        const upsertMany = (
          input: readonly TEntity[],
          options?: UpsertOptions,
        ): readonly TEntity[] => {
          if (!isLatestRun()) {
            return input;
          }

          const updated = entity.upsertMany(input, options);
          setManyMode(updated);
          internal.state.value = getModeValue(internal, readEntityValueById);
          return updated;
        };

        const removeOne = (id: TEntityId): boolean => {
          if (!isLatestRun()) {
            return false;
          }

          const removed = entity.removeOne(id);
          internal.state.value = getModeValue(internal, readEntityValueById);
          return removed;
        };

        const removeMany = (ids: readonly TEntityId[]): readonly TEntityId[] => {
          if (!isLatestRun()) {
            return [];
          }

          const removedIds = entity.removeMany(ids);
          internal.state.value = getModeValue(internal, readEntityValueById);
          return removedIds;
        };

        const runContextBase = {
          scope: internal.scope,
          payload: internal.payload,
          setMeta: (metaInput: unknown) => {
            if (!isLatestRun()) {
              return;
            }

            const nextMeta = resolveValue(
              internal.state.meta,
              metaInput as ValueUpdater<unknown, unknown>,
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

        const runContext = runContextBase as SourceRunContext<
          TInput,
          TPayload,
          TEntity,
          RResult,
          TEntityId
        >;

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

          const previousValue = getModeValue(internal, readEntityValueById);
          const draftSeed = cloneValue(previousValue);
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
