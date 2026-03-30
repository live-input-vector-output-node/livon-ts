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

export type ActionCleanup = Cleanup;

export type ActionRunResult = ActionCleanup | void;

export type ActionRunContext<
  TIdentity,
  TPayload,
  TData,
  TMeta = unknown,
  TEntity extends object = UnitDataEntity<TData>,
> = EntityMutationRunContext<TIdentity, TPayload, TData, TMeta, unknown, TEntity>;

export interface ActionConfig<
  TIdentity extends object | undefined,
  TPayload,
  TEntity extends object,
  TMode extends UnitEntityMode,
  TMeta = unknown,
> {
  key: string;
  destroyDelay?: number;
  run: (
    context: ActionRunContext<
      TIdentity,
      TPayload,
      UnitDataByEntityMode<TEntity, TMode>,
      TMeta,
      TEntity
    >,
  ) => Promise<ActionRunResult> | ActionRunResult;
  defaultValue?: UnitDataByEntityMode<TEntity, TMode>;
}

export type ActionPayloadOfConfig<TConfig> =
  TConfig extends ActionConfig<object | undefined, infer TPayload, object, UnitEntityMode, unknown>
    ? TPayload
    : never;

export type ActionMetaOfConfig<TConfig> =
  TConfig extends ActionConfig<object | undefined, unknown, object, UnitEntityMode, infer TMeta>
    ? TMeta
    : never;

export type ActionBuilderInput<
  TEntityStore extends Entity<object, EntityId>,
  TMode extends UnitEntityMode,
> = UnitBuilderInput<TEntityStore, TMode>;

export interface ActionByEntityModeBuilder<
  TEntityStore extends Entity<object, EntityId>,
  TMode extends UnitEntityMode,
> {
  <
    TIdentity extends object | undefined,
  >(
    config: ActionConfig<
      TIdentity,
      unknown,
      EntityValueOfStore<TEntityStore>,
      TMode,
      unknown
    >,
  ): Action<
    TIdentity,
    unknown,
    UnitDataByEntityMode<EntityValueOfStore<TEntityStore>, TMode>,
    unknown
  >;
  <
    TIdentity extends object | undefined,
    TPayload,
  >(
    config: ActionConfig<
      TIdentity,
      TPayload,
      EntityValueOfStore<TEntityStore>,
      TMode,
      unknown
    >,
  ): Action<
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
    config: ActionConfig<
      TIdentity,
      TPayload,
      EntityValueOfStore<TEntityStore>,
      TMode,
      TMeta
    >,
  ): Action<
    TIdentity,
    TPayload,
    UnitDataByEntityMode<EntityValueOfStore<TEntityStore>, TMode>,
    TMeta
  >;
}

export interface ActionBuilder {
  <
    TEntityStore extends Entity<object, EntityId>,
    TMode extends UnitEntityMode,
  >(
    input: ActionBuilderInput<TEntityStore, TMode>,
  ): ActionByEntityModeBuilder<TEntityStore, TMode>;
}

export interface ActionRunConfig {}

export type ActionSetAction<
  TPayload,
  TData,
  TMeta = unknown,
> = UnitSetAction<
  TPayload,
  ActionRunConfig,
  TData,
  TMeta | null
>;

export type ActionRunInput<
  TPayload,
  TData = unknown,
  TMeta = unknown,
> =
  | TPayload
  | ActionSetAction<TPayload, TData, TMeta>;

export type ActionRun<
  TPayload,
  TData,
  TMeta = unknown,
> = UnitRun<
  TPayload,
  ActionRunConfig,
  TData,
  TMeta | null
>;

export type ActionExecute<
  TPayload,
  TData,
  TMeta = unknown,
> = ActionRun<TPayload, TData, TMeta>;

export type ActionSnapshot<
  TPayload,
  TData,
  TMeta = unknown,
> = UnitSnapshot<TData, TMeta | null> & {
  submit: ActionExecute<TPayload, TData, TMeta>;
};

export interface ActionUnit<
  TPayload,
  TData,
  TMeta = unknown,
> {
  getSnapshot: () => ActionSnapshot<TPayload, TData, TMeta>;
  subscribe: (listener: EffectListener<TData, TMeta | null>) => (() => void) | void;
}

export interface Action<
  TIdentity extends object | undefined = object | undefined,
  TPayload = unknown,
  TData = unknown,
  TMeta = unknown,
> {
  (identity: TIdentity): ActionUnit<TPayload, TData, TMeta>;
}

export type ActionUnitState<TData, TMeta = unknown> = Snapshot<
  TData,
  UnitStatus,
  TMeta,
  {
    context: unknown;
  }
>;

export interface ActionUnitInternal<
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
  state: ActionUnitState<TData, TMeta>;
  listeners: Set<EffectListener<TData, TMeta | null>>;
  inFlightByPayload: Map<string, Promise<TData>>;
  cleanup: ActionCleanup | null;
  runSequence: number;
  latestRunSequence: number;
  stopped: boolean;
  destroyed: boolean;
  unit: ActionUnit<TPayload, TData, TMeta>;
}

export type ActionUnitByKeyMap<
  TIdentity extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> = Map<string, ActionUnitInternal<TIdentity, TPayload, TData, TMeta>>;

export interface ActionRunGate {
  isLatestRun: () => boolean;
}

export interface ActionRunContextEntry<
  TIdentity,
  TPayload,
  TData,
  TMeta = unknown,
  TEntity extends object = UnitDataEntity<TData>,
> {
  gate: ActionRunGate;
  context: ActionRunContext<TIdentity, TPayload, TData, TMeta, TEntity>;
}

export type ActionMetaUpdater<TMeta = unknown> = ValueUpdater<TMeta | null, TMeta | null>;
