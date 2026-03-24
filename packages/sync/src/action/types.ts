import { type Entity, type EntityId, type UpsertOptions } from '../entity.js';
import {
  type EffectListener,
  type InputUpdater,
  type ValueUpdater,
} from '../utils/index.js';

export interface ActionCleanup {
  (): void;
}

export type ActionRunResult<RResult> = RResult | ActionCleanup | void;

export interface ActionRunContext<
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

export interface ActionConfig<
  TInput extends object | undefined,
  TPayload,
  TEntity extends object,
  RResult,
  TEntityId extends EntityId = string,
> {
  entity: Entity<TEntity, TEntityId>;
  destroyDelay?: number;
  run: (
    context: ActionRunContext<TInput, TPayload, TEntity, RResult, TEntityId>,
  ) => Promise<ActionRunResult<RResult>> | ActionRunResult<RResult>;
  defaultValue?: RResult;
}

export interface ActionUnit<
  TPayload,
  RResult,
  UUpdate extends RResult,
> {
  (
    payloadInput?: TPayload | InputUpdater<TPayload>,
  ): ActionUnit<TPayload, RResult, UUpdate>;
  destroyDelay: number;
  run: (payloadInput?: TPayload | InputUpdater<TPayload>) => Promise<RResult>;
  get: () => RResult;
  effect: (listener: EffectListener<RResult>) => (() => void) | void;
  stop: () => void;
  destroy: () => void;
}

export interface Action<
  TInput extends object | undefined = object | undefined,
  TPayload = unknown,
  RResult = unknown,
  UUpdate extends RResult = RResult,
> {
  (scope: TInput): ActionUnit<TPayload, RResult, UUpdate>;
}

export interface ActionUnitState<RResult> {
  value: RResult;
  status: 'idle' | 'loading' | 'success' | 'error';
  meta: unknown;
  context: unknown;
}

export interface ActionUnitInternal<
  TInput extends object | undefined,
  TPayload,
  TEntityId extends EntityId,
  RResult,
  UUpdate extends RResult,
> {
  key: string;
  destroyDelay: number;
  scope: TInput;
  payload: TPayload;
  mode: 'one' | 'many';
  hasEntityValue: boolean;
  membershipIds: readonly TEntityId[];
  state: ActionUnitState<RResult>;
  listeners: Set<EffectListener<RResult>>;
  inFlightByPayload: Map<string, Promise<RResult>>;
  cleanup: ActionCleanup | null;
  runSequence: number;
  latestRunSequence: number;
  stopped: boolean;
  destroyed: boolean;
  unit: ActionUnit<TPayload, RResult, UUpdate>;
}

export type ActionUnitByKeyMap<
  TInput extends object | undefined,
  TPayload,
  TEntityId extends EntityId,
  RResult,
  UUpdate extends RResult,
> = Map<string, ActionUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>>;

export interface ActionRunGate {
  isLatestRun: () => boolean;
}

export interface ActionRunContextEntry<
  TInput,
  TPayload,
  TEntity extends object,
  RResult,
  TEntityId extends EntityId,
> {
  gate: ActionRunGate;
  context: ActionRunContext<TInput, TPayload, TEntity, RResult, TEntityId>;
}

export type ActionMetaUpdater = ValueUpdater<unknown, unknown>;
