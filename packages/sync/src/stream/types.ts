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

export interface StreamCleanup {
  (): void;
}

export interface StreamRunContext<
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
  deleteOne: (id: EntityId) => boolean;
  deleteMany: (ids: readonly EntityId[]) => readonly EntityId[];
  getValue: () => TData;
}

export type StreamRunResult = StreamCleanup | void;

export interface StreamConfig<
  TIdentity extends object | undefined,
  TPayload,
  TData,
  TMeta = unknown,
> {
  entity: Entity<UnitDataEntity<TData>, EntityId>;
  destroyDelay?: number;
  run: (
    context: StreamRunContext<TIdentity, TPayload, TData, TMeta>,
  ) => Promise<StreamRunResult> | StreamRunResult;
  defaultValue?: TData;
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

export interface StreamUnit<
  TPayload,
  TData,
  TMeta = unknown,
> {
  run: StreamRun<TPayload, TData, TMeta>;
  getSnapshot: () => UnitSnapshot<TData, TMeta | null>;
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

export interface StreamUnitState<TData, TMeta = unknown> {
  value: TData;
  status: UnitStatus;
  meta: TMeta | null;
  context: unknown;
}

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
> {
  context: StreamRunContext<TIdentity, TPayload, TData, TMeta>;
}

export type StreamMetaUpdater<TMeta = unknown> = ValueUpdater<TMeta | null, TMeta | null>;
