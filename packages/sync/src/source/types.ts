import {
  type CacheConfig,
  type CacheTtl,
  type DraftMode,
  type Entity,
  type EntityId,
  type UpsertOptions,
} from '../entity.js';
import {
  type EffectListener,
  type InputUpdater,
  type ModeValueReadWriteInput,
  type UnitDataEntity,
  type UnitDataUpdate,
  type UnitStatus,
  type ValueUpdater,
} from '../utils/index.js';

export interface SourceDestroyContext<TInput, TPayload> {
  scope: TInput;
  payload: TPayload;
}

export interface SourceCleanup {
  (): void;
}

export type SourceRunResult<TData> = TData | SourceCleanup | void;

export interface SourceRunContext<
  TInput,
  TPayload,
  TData,
  TMeta = unknown,
> {
  scope: TInput;
  payload: TPayload;
  setMeta: (meta: TMeta | null | ValueUpdater<TMeta | null, TMeta | null>) => void;
  upsertOne: (input: UnitDataEntity<TData>, options?: UpsertOptions) => UnitDataEntity<TData>;
  upsertMany: (
    input: readonly UnitDataEntity<TData>[],
    options?: UpsertOptions,
  ) => readonly UnitDataEntity<TData>[];
  removeOne: (id: EntityId) => boolean;
  removeMany: (ids: readonly EntityId[]) => readonly EntityId[];
  reset: () => void;
  getValue: () => TData;
}

export interface SourceConfig<
  TInput extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> {
  entity: Entity<UnitDataEntity<TData>, EntityId>;
  ttl?: number;
  draft?: DraftMode;
  cache?: CacheConfig;
  destroyDelay?: number;
  onDestroy?: (context: SourceDestroyContext<TInput, TPayload>) => void;
  run: (
    context: SourceRunContext<TInput, TPayload, TData, TMeta>,
  ) => Promise<SourceRunResult<TData>> | SourceRunResult<TData>;
  defaultValue?: TData;
}

export interface SourceDraftApi<TData> {
  set: (input: UnitDataUpdate<TData> | ValueUpdater<TData, UnitDataUpdate<TData>>) => void;
  clean: () => void;
}

export interface SourceUnit<
  TInput extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> {
  (payloadInput?: TPayload | InputUpdater<TPayload>): SourceUnit<TInput, TPayload, TData, TMeta>;
  ttl: number;
  cacheTtl: CacheTtl;
  destroyDelay: number;
  run: (payloadInput?: TPayload | InputUpdater<TPayload>) => Promise<TData>;
  get: () => TData;
  draft: SourceDraftApi<TData>;
  effect: (listener: EffectListener<TData, TMeta | null>) => (() => void) | void;
  refetch: (payloadInput?: TPayload | InputUpdater<TPayload>) => Promise<TData>;
  force: (payloadInput?: TPayload | InputUpdater<TPayload>) => Promise<TData>;
  reset: () => void;
  stop: () => void;
  destroy: () => void;
}

export interface Source<
  TInput extends object | undefined = object | undefined,
  TPayload = unknown,
  TData = unknown,
  TMeta = unknown,
> {
  (scope: TInput): SourceUnit<TInput, TPayload, TData, TMeta>;
}

export interface SourceUnitState<TData, TMeta = unknown> {
  value: TData;
  status: UnitStatus;
  meta: TMeta | null;
  context: SourceContext;
}

export interface SourceUnitInternal<
  TInput extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> {
  key: string;
  ttl: number;
  destroyDelay: number;
  scope: TInput;
  payload: TPayload;
  state: SourceUnitState<TData, TMeta>;
  mode: 'one' | 'many';
  modeLocked: boolean;
  hasEntityValue: boolean;
  membershipIds: readonly EntityId[];
  readWrite: ModeValueReadWriteInput;
  listeners: Set<EffectListener<TData, TMeta | null>>;
  inFlightByPayload: Map<string, Promise<TData>>;
  runSequence: number;
  latestRunSequence: number;
  lastRunAt: number | null;
  cleanup: SourceCleanup | null;
  stopped: boolean;
  destroyed: boolean;
  destroyHandled: boolean;
  unit: SourceUnit<TInput, TPayload, TData, TMeta>;
}

export type SourceUnitByKeyMap<
  TInput extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> = Map<string, SourceUnitInternal<TInput, TPayload, TData, TMeta>>;

export interface SourceRunGate {
  isLatestRun: () => boolean;
}

export interface SourceRunContextEntry<
  TInput,
  TPayload,
  TData,
  TMeta = unknown,
> {
  gate: SourceRunGate;
  context: SourceRunContext<TInput, TPayload, TData, TMeta>;
}

export interface SourceContext {
  cacheState: 'disabled' | 'miss' | 'hit' | 'stale';
  error: unknown;
}

export interface SourceCacheRecord<TEntity extends object> {
  mode: 'one' | 'many';
  entities: readonly TEntity[];
  writtenAt: number;
}

export interface ResolveCacheTtlInput {
  sourceCache: CacheConfig | undefined;
  entityCache: CacheConfig | undefined;
}

export interface ResolveCacheLruMaxEntriesInput {
  sourceCache: CacheConfig | undefined;
  entityCache: CacheConfig | undefined;
}

export interface ResolveCacheStorageInput {
  sourceCache: CacheConfig | undefined;
  entityCache: CacheConfig | undefined;
}

export interface ResolveCacheKeyInput {
  sourceCache: CacheConfig | undefined;
  entityCache: CacheConfig | undefined;
  sourceKey: string;
}

export interface IsCacheRecordExpiredInput {
  ttl: CacheTtl;
  writtenAt: number;
}

export interface ReadEntityValueById<TId extends EntityId, TEntity extends object> {
  (id: TId): TEntity | undefined;
}

export type SourceMetaUpdater<TMeta = unknown> = ValueUpdater<TMeta | null, TMeta | null>;
