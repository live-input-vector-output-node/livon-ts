import { type Entity, type EntityId, type UpsertOptions } from '../entity.js';
import {
  type EffectListener,
  type InputUpdater,
  type ModeValueReadWriteInput,
  type UnitDataEntity,
  type UnitStatus,
  type ValueUpdater,
} from '../utils/index.js';

export interface ActionCleanup {
  (): void;
}

export type ActionRunResult<TData> = TData | ActionCleanup | void;

export interface ActionRunContext<
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
  getValue: () => TData;
}

export interface ActionConfig<
  TInput extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> {
  entity: Entity<UnitDataEntity<TData>, EntityId>;
  destroyDelay?: number;
  run: (
    context: ActionRunContext<TInput, TPayload, TData, TMeta>,
  ) => Promise<ActionRunResult<TData>> | ActionRunResult<TData>;
  defaultValue?: TData;
}

export interface ActionUnit<
  TPayload,
  TData,
  TMeta = unknown,
> {
  (
    payloadInput?: TPayload | InputUpdater<TPayload>,
  ): ActionUnit<TPayload, TData, TMeta>;
  destroyDelay: number;
  run: (payloadInput?: TPayload | InputUpdater<TPayload>) => Promise<TData>;
  get: () => TData;
  effect: (listener: EffectListener<TData, TMeta | null>) => (() => void) | void;
  stop: () => void;
  destroy: () => void;
}

export interface Action<
  TInput extends object | undefined = object | undefined,
  TPayload = unknown,
  TData = unknown,
  TMeta = unknown,
> {
  (scope: TInput): ActionUnit<TPayload, TData, TMeta>;
}

export interface ActionUnitState<TData, TMeta = unknown> {
  value: TData;
  status: UnitStatus;
  meta: TMeta | null;
  context: unknown;
}

export interface ActionUnitInternal<
  TInput extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> {
  key: string;
  destroyDelay: number;
  scope: TInput;
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
  TInput extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> = Map<string, ActionUnitInternal<TInput, TPayload, TData, TMeta>>;

export interface ActionRunGate {
  isLatestRun: () => boolean;
}

export interface ActionRunContextEntry<
  TInput,
  TPayload,
  TData,
  TMeta = unknown,
> {
  gate: ActionRunGate;
  context: ActionRunContext<TInput, TPayload, TData, TMeta>;
}

export type ActionMetaUpdater<TMeta = unknown> = ValueUpdater<TMeta | null, TMeta | null>;
