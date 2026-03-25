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
  reset: () => void;
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
  reset: () => void;
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

export interface SourceUnitState<RResult> {
  value: RResult;
  status: UnitStatus;
  meta: unknown;
  context: SourceContext;
}

export interface SourceUnitInternal<
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
  modeLocked: boolean;
  hasEntityValue: boolean;
  membershipIds: readonly TEntityId[];
  readWrite: ModeValueReadWriteInput;
  listeners: Set<EffectListener<RResult>>;
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

export type SourceUnitByKeyMap<
  TInput extends object | undefined,
  TPayload,
  TEntityId extends EntityId,
  RResult,
  UUpdate extends RResult,
> = Map<string, SourceUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>>;

export interface SourceRunGate {
  isLatestRun: () => boolean;
}

export interface SourceRunContextEntry<
  TInput,
  TPayload,
  TEntity extends object,
  RResult,
  TEntityId extends EntityId,
> {
  gate: SourceRunGate;
  context: SourceRunContext<TInput, TPayload, TEntity, RResult, TEntityId>;
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

export type SourceMetaUpdater = ValueUpdater<unknown, unknown>;
