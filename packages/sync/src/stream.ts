import { type Entity, type EntityId, type UpsertOptions } from './entity.js';
import {
  createUnitSnapshot,
  notifyEffectListeners,
  resolveInput,
  resolveValue,
  stableSerialize,
  type EffectListener,
  type InputUpdater,
  type ValueUpdater,
} from './utils/index.js';
import { type Source } from './source.js';

export interface StreamCleanup {
  (): void;
}

export interface StreamRunContext<
  TInput,
  TPayload,
  TSourcePayload,
  TSourceResult,
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
  refetch: (
    scopeInput?: TInput | InputUpdater<TInput>,
  ) => (
    payloadInput?: TSourcePayload | InputUpdater<TSourcePayload>,
  ) => Promise<TSourceResult>;
  getValue: () => RResult;
}

export type StreamRunResult<RResult> = RResult | StreamCleanup | void;

export interface StreamConfig<
  TInput extends object | undefined,
  TPayload,
  TEntity extends object,
  RResult,
  UUpdate extends RResult,
  TSourcePayload = unknown,
  TSourceResult = unknown,
  TSourceUpdate extends TSourceResult = TSourceResult,
  TEntityId extends EntityId = string,
> {
  entity: Entity<TEntity, TEntityId>;
  destroyDelay?: number;
  source?: Source<TInput, TSourcePayload, TSourceResult, TSourceUpdate>;
  run: (
    context: StreamRunContext<
      TInput,
      TPayload,
      TSourcePayload,
      TSourceResult,
      TEntity,
      RResult,
      TEntityId
    >,
  ) => Promise<StreamRunResult<RResult>> | StreamRunResult<RResult>;
  defaultValue?: RResult;
  update?: (current: RResult, update: UUpdate) => RResult;
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
  set: (input: UUpdate | ValueUpdater<RResult, UUpdate>) => void;
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

export type StreamUnitByKeyMap<
  TInput extends object | undefined,
  TPayload,
  TEntityId extends EntityId,
  RResult,
  UUpdate extends RResult,
> = Map<string, StreamUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>>;

interface StreamUnitState<RResult> {
  value: RResult;
  status: 'idle' | 'loading' | 'success' | 'error';
  meta: unknown;
  context: unknown;
}

interface StreamUnitInternal<
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
  mode: 'raw' | 'one' | 'many';
  membershipIds: readonly TEntityId[];
  state: StreamUnitState<RResult>;
  listeners: Set<EffectListener<RResult>>;
  stopCallback: StreamCleanup | null;
  started: boolean;
  destroyed: boolean;
  unit: StreamUnit<TPayload, RResult, UUpdate>;
}

const DEFAULT_DESTROY_DELAY = 250;

const isStreamCleanup = <RResult>(
  input: StreamRunResult<RResult>,
): input is StreamCleanup => {
  return typeof input === 'function';
};

const getModeValue = <
  TInput extends object | undefined,
  TPayload,
  TEntityId extends EntityId,
  TEntity extends object,
  RResult,
  UUpdate extends RResult,
>(
  internal: StreamUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>,
  entityStore: Entity<TEntity, TEntityId>,
): RResult => {
  if (internal.mode === 'many') {
    const manyValue = internal.membershipIds
      .map((id) => entityStore.getById(id))
      .filter((entry): entry is TEntity => entry !== undefined);

    return manyValue as RResult;
  }

  if (internal.mode === 'one') {
    const firstId = internal.membershipIds[0];
    const oneValue = firstId ? entityStore.getById(firstId) ?? null : null;

    return oneValue as RResult;
  }

  return internal.state.value;
};

export const stream = <
  TInput extends object | undefined,
  TPayload = unknown,
  TEntity extends object = object,
  RResult = unknown,
  UUpdate extends RResult = RResult,
  TSourcePayload = unknown,
  TSourceResult = unknown,
  TSourceUpdate extends TSourceResult = TSourceResult,
  TEntityId extends EntityId = string,
>({
  entity,
  destroyDelay = entity.destroyDelay ?? DEFAULT_DESTROY_DELAY,
  source,
  run,
  defaultValue,
  update,
}: StreamConfig<
  TInput,
  TPayload,
  TEntity,
  RResult,
  UUpdate,
  TSourcePayload,
  TSourceResult,
  TSourceUpdate,
  TEntityId
>,
): Stream<TInput, TPayload, RResult, UUpdate> => {
  const unitsByKey: StreamUnitByKeyMap<TInput, TPayload, TEntityId, RResult, UUpdate> =
    new Map<string, StreamUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>>();

  const notifyUnit = (
    internal: StreamUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>,
  ): void => {
    internal.state.value = getModeValue(internal, entity);

    notifyEffectListeners(
      internal.listeners,
      createUnitSnapshot({
        value: internal.state.value,
        status: internal.state.status,
        meta: internal.state.meta,
        context: internal.state.context,
      }),
    );
  };

  const streamFactory: Stream<TInput, TPayload, RResult, UUpdate> = (scope) => {
    const key = stableSerialize(scope);
    const existingUnit = unitsByKey.get(key);

    if (existingUnit) {
      return existingUnit.unit;
    }

    const initialValue = (defaultValue ?? null) as RResult;

    const internal: StreamUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate> = {
      key,
      destroyDelay,
      scope,
      payload: undefined as TPayload,
        mode: 'raw',
        membershipIds: [],
        state: {
          value: initialValue,
          status: 'idle',
          meta: null,
          context: null,
        },
        listeners: new Set<EffectListener<RResult>>(),
        stopCallback: null,
        started: false,
        destroyed: false,
      unit: {} as StreamUnit<TPayload, RResult, UUpdate>,
    };
    let sourcePayload: TSourcePayload | undefined;

      const setRawMode = (): void => {
        internal.mode = 'raw';
        internal.membershipIds = [];
        entity.clearUnitMembership(internal.key);
      };

      const setOneMode = (value: TEntity): void => {
        const id = entity.idOf(value);
        const membershipIds = [id];

        internal.mode = 'one';
        internal.membershipIds = membershipIds;
        entity.setUnitMembership({
          key: internal.key,
          ids: membershipIds,
        });
      };

      const setManyMode = (value: readonly TEntity[]): void => {
        const membershipIds = value.map((entry) => entity.idOf(entry));

        internal.mode = 'many';
        internal.membershipIds = membershipIds;
        entity.setUnitMembership({
          key: internal.key,
          ids: membershipIds,
        });
      };

      const unregisterFromEntity = entity.registerUnit({
        key: internal.key,
        onChange: () => {
          if (internal.destroyed) {
            return;
          }

          notifyUnit(internal);
        },
      });

      const runWithPayload = (eventPayload: TPayload): Promise<RResult> => {
        if (internal.destroyed) {
          return Promise.resolve(internal.state.value);
        }

        internal.state.status = 'loading';
        internal.state.context = null;
        notifyUnit(internal);

        const runContext: StreamRunContext<
          TInput,
          TPayload,
          TSourcePayload,
          TSourceResult,
          TEntity,
          RResult,
          TEntityId
        > = {
          scope: internal.scope,
          payload: eventPayload,
          setMeta: (meta) => {
            internal.state.meta = meta;
            notifyUnit(internal);
          },
          upsertOne: (input, options) => {
            const updated = entity.upsertOne(input, options);
            setOneMode(updated);
            internal.state.value = getModeValue(internal, entity);
            return updated;
          },
          upsertMany: (input, options) => {
            const updated = entity.upsertMany(input, options);
            setManyMode(updated);
            internal.state.value = getModeValue(internal, entity);
            return updated;
          },
          removeOne: (id) => {
            const removed = entity.removeOne(id);
            internal.state.value = getModeValue(internal, entity);
            return removed;
          },
          removeMany: (ids) => {
            const removedIds = entity.removeMany(ids);
            internal.state.value = getModeValue(internal, entity);
            return removedIds;
          },
          refetch: (scopeInput) => {
            return (payloadInput) => {
              if (!source) {
                return Promise.resolve(undefined as TSourceResult);
              }

              const nextScope = resolveInput(internal.scope, scopeInput);

              if (payloadInput === undefined) {
                if (sourcePayload === undefined) {
                  return source(nextScope).force();
                }

                return source(nextScope).force(sourcePayload);
              }

              if (typeof payloadInput === 'function') {
                if (sourcePayload === undefined) {
                  return source(nextScope).force();
                }

                sourcePayload = resolveInput(sourcePayload, payloadInput);
                return source(nextScope).force(sourcePayload);
              }

              sourcePayload = payloadInput;
              return source(nextScope).force(sourcePayload);
            };
          },
          getValue: () => {
            internal.state.value = getModeValue(internal, entity);
            return internal.state.value;
          },
        };

        return Promise.resolve(run(runContext))
          .then((result) => {
            if (isStreamCleanup(result)) {
              if (internal.destroyed || !internal.started) {
                result();
              } else {
                internal.stopCallback = result;
              }

              internal.state.value = getModeValue(internal, entity);
              internal.state.status = 'success';
              internal.state.context = null;
              notifyUnit(internal);

              return internal.state.value;
            }

            if (result !== undefined) {
              setRawMode();
              internal.state.value = result as RResult;
            } else {
              internal.state.value = getModeValue(internal, entity);
            }

            internal.state.status = 'success';
            internal.state.context = null;
            notifyUnit(internal);

            return internal.state.value;
          })
          .catch((error: unknown) => {
            internal.state.status = 'error';
            internal.state.context = error;
            notifyUnit(internal);
            throw error;
          });
      };

      const stop = (): void => {
        if (!internal.started) {
          return;
        }

        internal.started = false;

        if (internal.stopCallback) {
          internal.stopCallback();
          internal.stopCallback = null;
        }
      };

    const start = (
      payloadInput?: TPayload | InputUpdater<TPayload>,
    ): void => {
        if (internal.started || internal.destroyed) {
          return;
        }

      internal.payload = resolveInput(internal.payload, payloadInput);
        internal.started = true;
        void runWithPayload(internal.payload).catch(() => undefined);
      };

    const unit = ((payloadInput?: TPayload | InputUpdater<TPayload>) => {
      internal.payload = resolveInput(internal.payload, payloadInput);
      return unit;
    }) as StreamUnit<TPayload, RResult, UUpdate>;

    unit.destroyDelay = destroyDelay;
    unit.start = start;
    unit.stop = stop;
    unit.get = () => {
      internal.state.value = getModeValue(internal, entity);
      return internal.state.value;
    };
    unit.set = (input) => {
      if (internal.destroyed) {
        return;
      }

      const nextUpdate = resolveValue(internal.state.value, input);
      const nextValue = update
        ? update(internal.state.value, nextUpdate)
        : nextUpdate;

      setRawMode();
      internal.state.value = nextValue;
      notifyUnit(internal);
    };
    unit.effect = (listener) => {
      if (internal.destroyed) {
        return undefined;
      }

      internal.listeners.add(listener);

      return () => {
        internal.listeners.delete(listener);
      };
    };
    unit.destroy = () => {
      if (internal.destroyed) {
        return;
      }

      internal.destroyed = true;
      unregisterFromEntity();
      stop();
      internal.listeners.clear();
      unitsByKey.delete(internal.key);
    };

      internal.unit = unit;
      unitsByKey.set(key, internal);

      return unit;
  };

  return streamFactory;
};
