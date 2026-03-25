import { type Entity, type EntityId, type UpsertOptions } from '../entity.js';
import {
  type EffectListener,
  type InputUpdater,
  type ModeValueReadWriteInput,
  type UnitDataEntity,
  type UnitStatus,
  type ValueUpdater,
} from '../utils/index.js';

export interface StreamCleanup {
  (): void;
}

export interface StreamRunContext<
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

export type StreamRunResult<TData> = TData | StreamCleanup | void;

export interface StreamConfig<
  TInput extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> {
  entity: Entity<UnitDataEntity<TData>, EntityId>;
  destroyDelay?: number;
  run: (
    context: StreamRunContext<TInput, TPayload, TData, TMeta>,
  ) => Promise<StreamRunResult<TData>> | StreamRunResult<TData>;
  defaultValue?: TData;
}

export interface StreamUnit<
  TPayload,
  TData,
  TMeta = unknown,
> {
  (payloadInput?: TPayload | InputUpdater<TPayload>): StreamUnit<TPayload, TData, TMeta>;
  destroyDelay: number;
  start: (payloadInput?: TPayload | InputUpdater<TPayload>) => void;
  stop: () => void;
  get: () => TData;
  effect: (listener: EffectListener<TData, TMeta | null>) => (() => void) | void;
  destroy: () => void;
}

export interface Stream<
  TInput extends object | undefined = object | undefined,
  TPayload = unknown,
  TData = unknown,
  TMeta = unknown,
> {
  (scope: TInput): StreamUnit<TPayload, TData, TMeta>;
}

export interface StreamUnitState<TData, TMeta = unknown> {
  value: TData;
  status: UnitStatus;
  meta: TMeta | null;
  context: unknown;
}

export interface StreamUnitInternal<
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
  state: StreamUnitState<TData, TMeta>;
  listeners: Set<EffectListener<TData, TMeta | null>>;
  stopCallback: StreamCleanup | null;
  started: boolean;
  destroyed: boolean;
  unit: StreamUnit<TPayload, TData, TMeta>;
}

export type StreamUnitByKeyMap<
  TInput extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> = Map<string, StreamUnitInternal<TInput, TPayload, TData, TMeta>>;

export interface StreamRunContextEntry<
  TInput,
  TPayload,
  TData,
  TMeta = unknown,
> {
  context: StreamRunContext<TInput, TPayload, TData, TMeta>;
}

export type StreamMetaUpdater<TMeta = unknown> = ValueUpdater<TMeta | null, TMeta | null>;
