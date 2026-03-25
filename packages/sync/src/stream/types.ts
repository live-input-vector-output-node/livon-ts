import { type Entity, type EntityId, type UpsertOptions } from '../entity.js';
import {
  type EffectListener,
  type InputUpdater,
  type ModeValueReadWriteInput,
  type ValueUpdater,
} from '../utils/index.js';

export interface StreamCleanup {
  (): void;
}

export interface StreamRunContext<
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

export type StreamRunResult<RResult> = RResult | StreamCleanup | void;

export interface StreamConfig<
  TInput extends object | undefined,
  TPayload,
  TEntity extends object,
  RResult,
  TEntityId extends EntityId = string,
> {
  entity: Entity<TEntity, TEntityId>;
  destroyDelay?: number;
  run: (
    context: StreamRunContext<
      TInput,
      TPayload,
      TEntity,
      RResult,
      TEntityId
    >,
  ) => Promise<StreamRunResult<RResult>> | StreamRunResult<RResult>;
  defaultValue?: RResult;
}

export interface StreamUnit<
  TPayload,
  RResult,
  UUpdate extends RResult,
> {
  (payloadInput?: TPayload | InputUpdater<TPayload>): StreamUnit<TPayload, RResult, UUpdate>;
  destroyDelay: number;
  start: (payloadInput?: TPayload | InputUpdater<TPayload>) => void;
  stop: () => void;
  get: () => RResult;
  effect: (listener: EffectListener<RResult>) => (() => void) | void;
  destroy: () => void;
}

export interface Stream<
  TInput extends object | undefined = object | undefined,
  TPayload = unknown,
  RResult = unknown,
  UUpdate extends RResult = RResult,
> {
  (scope: TInput): StreamUnit<TPayload, RResult, UUpdate>;
}

export interface StreamUnitState<RResult> {
  value: RResult;
  status: 'idle' | 'loading' | 'success' | 'error';
  meta: unknown;
  context: unknown;
}

export interface StreamUnitInternal<
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
  modeLocked: boolean;
  hasEntityValue: boolean;
  membershipIds: readonly TEntityId[];
  readWrite: ModeValueReadWriteInput;
  state: StreamUnitState<RResult>;
  listeners: Set<EffectListener<RResult>>;
  stopCallback: StreamCleanup | null;
  started: boolean;
  destroyed: boolean;
  unit: StreamUnit<TPayload, RResult, UUpdate>;
}

export type StreamUnitByKeyMap<
  TInput extends object | undefined,
  TPayload,
  TEntityId extends EntityId,
  RResult,
  UUpdate extends RResult,
> = Map<string, StreamUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>>;

export interface StreamRunContextEntry<
  TInput,
  TPayload,
  TEntity extends object,
  RResult,
  TEntityId extends EntityId,
> {
  context: StreamRunContext<TInput, TPayload, TEntity, RResult, TEntityId>;
}

export type StreamMetaUpdater = ValueUpdater<unknown, unknown>;
