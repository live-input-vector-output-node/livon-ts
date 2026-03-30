import {
  type CacheConfig,
  type CacheTtl,
  type Entity,
  type EntityId,
} from '../entity.js';
import {
  type Cleanup,
  type EntityValueOfStore,
  type EffectListener,
  type EntityMutationRunContext,
  type ModeValueReadWriteInput,
  type UnitDataByEntityMode,
  type UnitBuilderInput,
  type UnitEntityMode,
  type UnitRun,
  type UnitDataEntity,
  type UnitSetAction,
  type Snapshot,
  type UnitSnapshot,
  type UnitStatus,
  type ValueUpdater,
} from '../utils/index.js';

export interface SourceDestroyContext<TIdentity, TPayload> {
  identity: TIdentity;
  payload: TPayload;
}

export type SourceCleanup = Cleanup;

export type SourceRunResult = SourceCleanup | void;

export interface SourceRunContext<
  TIdentity,
  TPayload,
  TData,
  TMeta = unknown,
  TEntity extends object = UnitDataEntity<TData>,
> extends EntityMutationRunContext<
  TIdentity,
  TPayload,
  TData,
  TMeta,
  SourceContext,
  TEntity
> {
  set: (input: TData | ValueUpdater<TData, TData>) => void;
  reset: () => void;
}

export interface SourceConfig<
  TIdentity extends object | undefined,
  TPayload,
  TEntity extends object,
  TMode extends UnitEntityMode,
  TMeta = unknown,
> {
  key: string;
  ttl?: number;
  cache?: CacheConfig;
  destroyDelay?: number;
  run: (
    context: SourceRunContext<
      TIdentity,
      TPayload,
      UnitDataByEntityMode<TEntity, TMode>,
      TMeta,
      TEntity
    >,
  ) => Promise<SourceRunResult> | SourceRunResult;
  defaultValue?: UnitDataByEntityMode<TEntity, TMode>;
}

export type SourcePayloadOfConfig<TConfig> =
  TConfig extends SourceConfig<object | undefined, infer TPayload, object, UnitEntityMode, unknown>
    ? TPayload
    : never;

export type SourceMetaOfConfig<TConfig> =
  TConfig extends SourceConfig<object | undefined, unknown, object, UnitEntityMode, infer TMeta>
    ? TMeta
    : never;


export type SourceBuilderInput<
  TEntityStore extends Entity<object, EntityId>,
  TMode extends UnitEntityMode,
> = UnitBuilderInput<TEntityStore, TMode>;

export interface SourceByEntityModeBuilder<
  TEntityStore extends Entity<object, EntityId>,
  TMode extends UnitEntityMode,
> {
  <
    TIdentity extends object | undefined,
  >(
    config: SourceConfig<
      TIdentity,
      unknown,
      EntityValueOfStore<TEntityStore>,
      TMode,
      unknown
    >,
  ): Source<
    TIdentity,
    unknown,
    UnitDataByEntityMode<EntityValueOfStore<TEntityStore>, TMode>,
    unknown
  >;
  <
    TIdentity extends object | undefined,
    TPayload,
  >(
    config: SourceConfig<
      TIdentity,
      TPayload,
      EntityValueOfStore<TEntityStore>,
      TMode,
      unknown
    >,
  ): Source<
    TIdentity,
    TPayload,
    UnitDataByEntityMode<EntityValueOfStore<TEntityStore>, TMode>,
    unknown
  >;
  <
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
  ): Source<
    TIdentity,
    TPayload,
    UnitDataByEntityMode<EntityValueOfStore<TEntityStore>, TMode>,
    TMeta
  >;
}

export interface SourceBuilder {
  <
    TEntityStore extends Entity<object, EntityId>,
    TMode extends UnitEntityMode,
  >(
    input: SourceBuilderInput<TEntityStore, TMode>,
  ): SourceByEntityModeBuilder<TEntityStore, TMode>;
}

export interface SourceRunConfig {
  mode?: 'default' | 'refetch' | 'force';
}

export type SourceFetchConfig = SourceRunConfig;

export type SourceSetAction<
  TPayload,
  TData,
  TMeta = unknown,
> = UnitSetAction<
  TPayload,
  SourceRunConfig,
  TData,
  TMeta | null,
  SourceContext
>;

export type SourceRunInput<
  TPayload,
  TData = unknown,
  TMeta = unknown,
> =
  | TPayload
  | SourceSetAction<TPayload, TData, TMeta>;

export type SourceFetchInput<
  TPayload,
  TData = unknown,
  TMeta = unknown,
> = SourceRunInput<TPayload, TData, TMeta>;

export type SourceRun<
  TPayload,
  TData,
  TMeta = unknown,
> = UnitRun<
  TPayload,
  SourceRunConfig,
  TData,
  TMeta | null,
  SourceContext
>;

export type SourceFetch<
  TPayload,
  TData,
  TMeta = unknown,
> = SourceRun<TPayload, TData, TMeta>;

export type SourceSnapshot<
  TIdentity,
  TPayload,
  TData,
  TMeta = unknown,
> = UnitSnapshot<TData, TMeta | null, SourceContext, TIdentity> & {
  load: SourceFetch<TPayload, TData, TMeta>;
  refetch: (input?: SourceFetchInput<TPayload, TData, TMeta>) => Promise<void>;
  force: (input?: SourceFetchInput<TPayload, TData, TMeta>) => Promise<void>;
};

export interface SourceUnit<
  TIdentity extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> {
  getSnapshot: () => SourceSnapshot<TIdentity, TPayload, TData, TMeta>;
  subscribe: (listener: EffectListener<TData, TMeta | null, SourceContext, TIdentity>) => (() => void) | void;
}

export interface Source<
  TIdentity extends object | undefined = object | undefined,
  TPayload = unknown,
  TData = unknown,
  TMeta = unknown,
> {
  (identity: TIdentity): SourceUnit<TIdentity, TPayload, TData, TMeta>;
}

export type SourceUnitState<TData, TMeta = unknown> = Snapshot<
  TData,
  UnitStatus,
  TMeta,
  {
    context: SourceContext;
  }
>;

export interface SourceUnitInternal<
  TIdentity extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> {
  key: string;
  ttl: number;
  destroyDelay: number;
  identity: TIdentity;
  payload: TPayload;
  state: SourceUnitState<TData, TMeta>;
  mode: 'one' | 'many';
  modeLocked: boolean;
  hasEntityValue: boolean;
  membershipIds: readonly EntityId[];
  readWrite: ModeValueReadWriteInput;
  listeners: Set<EffectListener<TData, TMeta | null, SourceContext, TIdentity>>;
  inFlightByPayload: Map<string, Promise<TData>>;
  runSequence: number;
  latestRunSequence: number;
  lastRunAt: number | null;
  cleanup: SourceCleanup | null;
  stopped: boolean;
  destroyed: boolean;
  destroyHandled: boolean;
  unit: SourceUnit<TIdentity, TPayload, TData, TMeta>;
}

export type SourceUnitByKeyMap<
  TIdentity extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> = Map<string, SourceUnitInternal<TIdentity, TPayload, TData, TMeta>>;

export interface SourceRunGate {
  isLatestRun: () => boolean;
}

export interface SourceRunContextEntry<
  TIdentity,
  TPayload,
  TData,
  TMeta = unknown,
  TEntity extends object = UnitDataEntity<TData>,
> {
  gate: SourceRunGate;
  context: SourceRunContext<TIdentity, TPayload, TData, TMeta, TEntity>;
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

export interface ResolveCacheKeyInput {
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
