import { type Entity, type EntityId, type UpsertOptions } from './entity.js';
import {
  createUnitSnapshot,
  notifyEffectListeners,
  resolveInput,
  resolveValue,
  serializeKey,
  type EffectListener,
  type InputUpdater,
  type ValueUpdater,
} from './utils/index.js';

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
  entity: {
    upsertOne: (input: TEntity, options?: UpsertOptions) => TEntity;
    upsertMany: (input: readonly TEntity[], options?: UpsertOptions) => readonly TEntity[];
    removeOne: (id: TEntityId) => boolean;
    removeMany: (ids: readonly TEntityId[]) => readonly TEntityId[];
  };
  getValue: () => RResult;
}

export type StreamRunResult<RResult> = RResult | StreamCleanup | void;

export interface StreamConfig<
  TInput extends object | undefined,
  TPayload,
  TEntity extends object,
  RResult,
  UUpdate extends RResult,
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
  mode: 'one' | 'many';
  hasEntityValue: boolean;
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

const isEntityValue = <TEntity extends object>(
  value: unknown,
): value is TEntity => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  if (!internal.hasEntityValue) {
    return internal.state.value;
  }

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
  TEntityId extends EntityId = string,
>({
  entity,
  destroyDelay = entity.destroyDelay ?? DEFAULT_DESTROY_DELAY,
  run,
  defaultValue,
  update,
}: StreamConfig<
  TInput,
  TPayload,
  TEntity,
  RResult,
  UUpdate,
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
    const key = serializeKey(scope);
    const existingUnit = unitsByKey.get(key);

    if (existingUnit) {
      return existingUnit.unit;
    }

    const initialValue = (defaultValue ?? null) as RResult;
    const initialMode: 'one' | 'many' = Array.isArray(initialValue) ? 'many' : 'one';

    const internal: StreamUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate> = {
      key,
      destroyDelay,
      scope,
      payload: undefined as TPayload,
      mode: initialMode,
      hasEntityValue: false,
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

      const setOneMode = (value: TEntity): void => {
        const id = entity.idOf(value);
        const membershipIds = [id];

        internal.mode = 'one';
        internal.hasEntityValue = true;
        internal.membershipIds = membershipIds;
        entity.setUnitMembership({
          key: internal.key,
          ids: membershipIds,
        });
      };

      const setManyMode = (value: readonly TEntity[]): void => {
        const membershipIds = value.map((entry) => entity.idOf(entry));

        internal.mode = 'many';
        internal.hasEntityValue = true;
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

        const upsertOne = (input: TEntity, options?: UpsertOptions): TEntity => {
          const updated = entity.upsertOne(input, options);
          setOneMode(updated);
          internal.state.value = getModeValue(internal, entity);
          return updated;
        };

        const upsertMany = (
          input: readonly TEntity[],
          options?: UpsertOptions,
        ): readonly TEntity[] => {
          const updated = entity.upsertMany(input, options);
          setManyMode(updated);
          internal.state.value = getModeValue(internal, entity);
          return updated;
        };

        const removeOne = (id: TEntityId): boolean => {
          const removed = entity.removeOne(id);
          internal.state.value = getModeValue(internal, entity);
          return removed;
        };

        const removeMany = (ids: readonly TEntityId[]): readonly TEntityId[] => {
          const removedIds = entity.removeMany(ids);
          internal.state.value = getModeValue(internal, entity);
          return removedIds;
        };

        const runEntity = {
          upsertOne,
          upsertMany,
          removeOne,
          removeMany,
        };

        const runContextBase = {
          scope: internal.scope,
          payload: eventPayload,
          setMeta: (metaInput: unknown) => {
            const nextMeta = resolveValue(
              internal.state.meta,
              metaInput as ValueUpdater<unknown, unknown>,
            );
            if (Object.is(nextMeta, internal.state.meta)) {
              return;
            }

            internal.state.meta = nextMeta;
            notifyUnit(internal);
          },
          entity: runEntity,
          getValue: () => {
            internal.state.value = getModeValue(internal, entity);
            return internal.state.value;
          },
        };

        const runContext = runContextBase as StreamRunContext<
          TInput,
          TPayload,
          TEntity,
          RResult,
          TEntityId
        >;

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

            internal.state.value = getModeValue(internal, entity);

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

        const currentValue = getModeValue(internal, entity);
        internal.state.value = currentValue;
        const nextUpdate = resolveValue(currentValue, input);
        const nextValue = update
          ? update(currentValue, nextUpdate)
          : nextUpdate;
        if (Object.is(nextValue, currentValue)) {
          return;
        }

        if (Array.isArray(nextValue)) {
          if (nextValue.length === 0) {
            internal.hasEntityValue = true;
            internal.membershipIds = [];
            entity.clearUnitMembership(internal.key);
            internal.state.value = getModeValue(internal, entity);
            notifyUnit(internal);
            return;
          }

          setManyMode(nextValue as readonly TEntity[]);
          entity.upsertMany(nextValue as readonly TEntity[]);
          return;
        }

        if (isEntityValue<TEntity>(nextValue)) {
          setOneMode(nextValue);
          entity.upsertOne(nextValue);
          return;
        }

        if (nextValue === null || nextValue === undefined) {
          internal.hasEntityValue = true;
          internal.membershipIds = [];
          entity.clearUnitMembership(internal.key);
          internal.state.value = getModeValue(internal, entity);
          notifyUnit(internal);
        }
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

    Object.defineProperty(unit, 'getSnapshot', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: () => {
        internal.state.value = getModeValue(internal, entity);
        return createUnitSnapshot({
          value: internal.state.value,
          status: internal.state.status,
          meta: internal.state.meta,
          context: internal.state.context,
        });
      },
    });

      internal.unit = unit;
      unitsByKey.set(key, internal);

      return unit;
  };

  return streamFactory;
};
