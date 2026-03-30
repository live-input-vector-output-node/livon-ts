import { type Entity, type EntityId, type UpsertOptions } from '../entity.js';
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

export interface ActionCleanup {
  (): void;
}

export type ActionRunResult<TData> = TData | ActionCleanup | void;

export interface ActionRunContext<
  TIdentity,
  TPayload,
  TData,
  TMeta = unknown,
> {
  identity: TIdentity;
  payload: TPayload;
  setMeta: (meta: TMeta | null | ValueUpdater<TMeta | null, TMeta | null>) => void;
  upsertOne: (input: UnitDataEntity<TData>, options?: UpsertOptions) => UnitDataEntity<TData>;
  upsertMany: (
    input: readonly UnitDataEntity<TData>[],
    options?: UpsertOptions,
  ) => readonly UnitDataEntity<TData>[];
  removeOne: (id: EntityId) => boolean;
  removeMany: (ids: readonly EntityId[]) => readonly EntityId[];
  getValue: () => TData;
}

export interface ActionConfig<
  TIdentity extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> {
  entity: Entity<UnitDataEntity<TData>, EntityId>;
  destroyDelay?: number;
  run: (
    context: ActionRunContext<TIdentity, TPayload, TData, TMeta>,
  ) => Promise<ActionRunResult<TData>> | ActionRunResult<TData>;
  defaultValue?: TData;
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

export interface ActionUnit<
  TPayload,
  TData,
  TMeta = unknown,
> {
  run: ActionRun<TPayload, TData, TMeta>;
  getSnapshot: () => UnitSnapshot<TData, TMeta | null>;
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

export interface ActionUnitState<TData, TMeta = unknown> {
  value: TData;
  status: UnitStatus;
  meta: TMeta | null;
  context: unknown;
}

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
> {
  gate: ActionRunGate;
  context: ActionRunContext<TIdentity, TPayload, TData, TMeta>;
}

export type ActionMetaUpdater<TMeta = unknown> = ValueUpdater<TMeta | null, TMeta | null>;
