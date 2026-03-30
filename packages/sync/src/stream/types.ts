import { type Entity, type EntityId } from '../entity.js';
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
  type UnitSetAction,
  type UnitDataEntity,
  type Snapshot,
  type UnitSnapshot,
  type UnitStatus,
  type ValueUpdater,
} from '../utils/index.js';

export type StreamCleanup = Cleanup;

export type StreamRunContext<
  TIdentity,
  TPayload,
  TData,
  TMeta = unknown,
  TEntity extends object = UnitDataEntity<TData>,
> = EntityMutationRunContext<TIdentity, TPayload, TData, TMeta, unknown, TEntity>;

export type StreamRunResult = StreamCleanup | void;

export interface StreamConfig<
  TIdentity extends object | undefined,
  TPayload,
  TEntity extends object,
  TMode extends UnitEntityMode,
  TMeta = unknown,
> {
  key: string;
  destroyDelay?: number;
  run: (
    context: StreamRunContext<
      TIdentity,
      TPayload,
      UnitDataByEntityMode<TEntity, TMode>,
      TMeta,
      TEntity
    >,
  ) => Promise<StreamRunResult> | StreamRunResult;
  defaultValue?: UnitDataByEntityMode<TEntity, TMode>;
}

export type StreamPayloadOfConfig<TConfig> =
  TConfig extends StreamConfig<object | undefined, infer TPayload, object, UnitEntityMode, unknown>
    ? TPayload
    : never;

export type StreamMetaOfConfig<TConfig> =
  TConfig extends StreamConfig<object | undefined, unknown, object, UnitEntityMode, infer TMeta>
    ? TMeta
    : never;

export type StreamBuilderInput<
  TEntityStore extends Entity<object, EntityId>,
  TMode extends UnitEntityMode,
> = UnitBuilderInput<TEntityStore, TMode>;

export interface StreamByEntityModeBuilder<
  TEntityStore extends Entity<object, EntityId>,
  TMode extends UnitEntityMode,
> {
  <
    TIdentity extends object | undefined,
  >(
    config: StreamConfig<
      TIdentity,
      unknown,
      EntityValueOfStore<TEntityStore>,
      TMode,
      unknown
    >,
  ): Stream<
    TIdentity,
    unknown,
    UnitDataByEntityMode<EntityValueOfStore<TEntityStore>, TMode>,
    unknown
  >;
  <
    TIdentity extends object | undefined,
    TPayload,
  >(
    config: StreamConfig<
      TIdentity,
      TPayload,
      EntityValueOfStore<TEntityStore>,
      TMode,
      unknown
    >,
  ): Stream<
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
    config: StreamConfig<
      TIdentity,
      TPayload,
      EntityValueOfStore<TEntityStore>,
      TMode,
      TMeta
    >,
  ): Stream<
    TIdentity,
    TPayload,
    UnitDataByEntityMode<EntityValueOfStore<TEntityStore>, TMode>,
    TMeta
  >;
}

export interface StreamBuilder {
  <
    TEntityStore extends Entity<object, EntityId>,
    TMode extends UnitEntityMode,
  >(
    input: StreamBuilderInput<TEntityStore, TMode>,
  ): StreamByEntityModeBuilder<TEntityStore, TMode>;
}

export interface StreamRunConfig {}

export type StreamSetAction<
  TPayload,
  TData,
  TMeta = unknown,
> = UnitSetAction<
  TPayload,
  StreamRunConfig,
  TData,
  TMeta | null
>;

export type StreamRunInput<
  TPayload,
  TData = unknown,
  TMeta = unknown,
> =
  | TPayload
  | StreamSetAction<TPayload, TData, TMeta>;

export type StreamRun<
  TPayload,
  TData,
  TMeta = unknown,
> = UnitRun<
  TPayload,
  StreamRunConfig,
  TData,
  TMeta | null
>;

export type StreamStart<
  TPayload,
  TData,
  TMeta = unknown,
> = StreamRun<TPayload, TData, TMeta>;

export type StreamSnapshot<
  TPayload,
  TData,
  TMeta = unknown,
> = UnitSnapshot<TData, TMeta | null> & {
  start: StreamStart<TPayload, TData, TMeta>;
  stop: () => void;
};

export interface StreamUnit<
  TPayload,
  TData,
  TMeta = unknown,
> {
  getSnapshot: () => StreamSnapshot<TPayload, TData, TMeta>;
  subscribe: (listener: EffectListener<TData, TMeta | null>) => (() => void) | void;
}

export interface Stream<
  TIdentity extends object | undefined = object | undefined,
  TPayload = unknown,
  TData = unknown,
  TMeta = unknown,
> {
  (identity: TIdentity): StreamUnit<TPayload, TData, TMeta>;
}

export type StreamUnitState<TData, TMeta = unknown> = Snapshot<
  TData,
  UnitStatus,
  TMeta,
  {
    context: unknown;
  }
>;

export interface StreamUnitInternal<
  TIdentity extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> {
  key: string;
  destroyDelay: number;
  identity: TIdentity;
  payload: TPayload;
  mode: 'one' | 'many';
  modeLocked: boolean;
  hasEntityValue: boolean;
  membershipIds: readonly EntityId[];
  readWrite: ModeValueReadWriteInput;
  state: StreamUnitState<TData, TMeta>;
  listeners: Set<EffectListener<TData, TMeta | null>>;
  stopCallback: StreamCleanup | null;
  started: boolean;
  destroyed: boolean;
  unit: StreamUnit<TPayload, TData, TMeta>;
}

export type StreamUnitByKeyMap<
  TIdentity extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> = Map<string, StreamUnitInternal<TIdentity, TPayload, TData, TMeta>>;

export interface StreamRunContextEntry<
  TIdentity,
  TPayload,
  TData,
  TMeta = unknown,
  TEntity extends object = UnitDataEntity<TData>,
> {
  context: StreamRunContext<TIdentity, TPayload, TData, TMeta, TEntity>;
}

export type StreamMetaUpdater<TMeta = unknown> = ValueUpdater<TMeta | null, TMeta | null>;
