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
  type ModeValueReadWriteInput,
  type UnitRun,
  type UnitSetAction,
  type UnitDataEntity,
  type UnitSnapshot,
  type UnitStatus,
  type ValueUpdater,
} from '../utils/index.js';

export interface SourceDestroyContext<TIdentity, TPayload> {
  identity: TIdentity;
  payload: TPayload;
}

export interface SourceCleanup {
  (): void;
}

export type SourceRunResult = SourceCleanup | void;

export interface SourceRunContext<
  TIdentity,
  TPayload,
  TData,
  TMeta = unknown,
> {
  identity: TIdentity;
  payload: TPayload;
  setMeta: (meta: TMeta | null | ValueUpdater<TMeta | null, TMeta | null>) => void;
  set: (input: TData | ValueUpdater<TData, TData>) => void;
  upsertOne: (input: UnitDataEntity<TData>, options?: UpsertOptions) => UnitDataEntity<TData>;
  upsertMany: (
    input: readonly UnitDataEntity<TData>[],
    options?: UpsertOptions,
  ) => readonly UnitDataEntity<TData>[];
  deleteOne: (id: EntityId) => boolean;
  deleteMany: (ids: readonly EntityId[]) => readonly EntityId[];
  reset: () => void;
  getValue: () => TData;
}

export interface SourceConfig<
  TIdentity extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> {
  key?: string;
  entity: Entity<UnitDataEntity<TData>, EntityId>;
  ttl?: number;
  draft?: DraftMode;
  cache?: CacheConfig;
  destroyDelay?: number;
  run: (
    context: SourceRunContext<TIdentity, TPayload, TData, TMeta>,
  ) => Promise<SourceRunResult> | SourceRunResult;
  defaultValue?: TData;
}

export interface SourceRunConfig {
  mode?: 'default' | 'refetch' | 'force';
}

export type SourceSetAction<
  TPayload,
  TData,
  TMeta = unknown,
> = UnitSetAction<
  TPayload,
  SourceRunConfig,
  TData,
  TMeta | null
>;

export type SourceRunInput<
  TPayload,
  TData = unknown,
  TMeta = unknown,
> =
  | TPayload
  | SourceSetAction<TPayload, TData, TMeta>;

export type SourceRun<
  TPayload,
  TData,
  TMeta = unknown,
> = UnitRun<
  TPayload,
  SourceRunConfig,
  TData,
  TMeta | null
>;

export interface SourceUnit<
  TIdentity extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> {
  identity: TIdentity;
  run: SourceRun<TPayload, TData, TMeta>;
  getSnapshot: () => UnitSnapshot<TData, TMeta | null>;
  subscribe: (listener: EffectListener<TData, TMeta | null>) => (() => void) | void;
}

export interface Source<
  TIdentity extends object | undefined = object | undefined,
  TPayload = unknown,
  TData = unknown,
  TMeta = unknown,
> {
  (identity: TIdentity): SourceUnit<TIdentity, TPayload, TData, TMeta>;
}

export interface SourceUnitState<TData, TMeta = unknown> {
  value: TData;
  status: UnitStatus;
  meta: TMeta | null;
  context: SourceContext;
}

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
  listeners: Set<EffectListener<TData, TMeta | null>>;
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
> {
  gate: SourceRunGate;
  context: SourceRunContext<TIdentity, TPayload, TData, TMeta>;
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
