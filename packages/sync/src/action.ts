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
  entity: {
    upsertOne: (input: TEntity, options?: UpsertOptions) => TEntity;
    upsertMany: (input: readonly TEntity[], options?: UpsertOptions) => readonly TEntity[];
    removeOne: (id: TEntityId) => boolean;
    removeMany: (ids: readonly TEntityId[]) => readonly TEntityId[];
  };
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

export type ActionUnitByKeyMap<
  TInput extends object | undefined,
  TPayload,
  TEntityId extends EntityId,
  RResult,
  UUpdate extends RResult,
> = Map<string, ActionUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>>;

interface ActionUnitState<RResult> {
  value: RResult;
  status: 'idle' | 'loading' | 'success' | 'error';
  meta: unknown;
  context: unknown;
}

interface ActionUnitInternal<
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
  inFlight: Promise<RResult> | null;
  inFlightByPayload: Map<string, Promise<RResult>>;
  cleanup: ActionCleanup | null;
  runSequence: number;
  latestRunSequence: number;
  stopped: boolean;
  destroyed: boolean;
  unit: ActionUnit<TPayload, RResult, UUpdate>;
}

const DEFAULT_DESTROY_DELAY = 250;

const invokeActionCleanup = (
  cleanup: ActionCleanup | null,
): void => {
  if (!cleanup) {
    return;
  }

  try {
    cleanup();
  } catch {
    return;
  }
};

const isActionCleanup = <RResult>(
  input: ActionRunResult<RResult>,
): input is ActionCleanup => {
  return typeof input === 'function';
};

const isEntityValue = <TEntity extends object>(value: unknown): value is TEntity => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isEntityArray = <TEntity extends object>(value: unknown): value is readonly TEntity[] => {
  return Array.isArray(value) && value.every((entry) => isEntityValue<TEntity>(entry));
};

const getModeValue = <
  TInput extends object | undefined,
  TPayload,
  TEntityId extends EntityId,
  TEntity extends object,
  RResult,
  UUpdate extends RResult,
>(
  internal: ActionUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>,
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

export const action = <
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
}: ActionConfig<TInput, TPayload, TEntity, RResult, TEntityId>,
): Action<TInput, TPayload, RResult, UUpdate> => {
  const unitsByKey: ActionUnitByKeyMap<TInput, TPayload, TEntityId, RResult, UUpdate> =
    new Map<string, ActionUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>>();

  const notifyUnit = (
    internal: ActionUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>,
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

  const actionFactory: Action<TInput, TPayload, RResult, UUpdate> = (scope) => {
    const key = serializeKey(scope);
    const existingUnit = unitsByKey.get(key);

    if (existingUnit) {
      return existingUnit.unit;
    }

    const initialValue = (defaultValue ?? null) as RResult;
    const initialMode: 'one' | 'many' = Array.isArray(initialValue) ? 'many' : 'one';

    const internal: ActionUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate> = {
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
      inFlight: null,
      inFlightByPayload: new Map<string, Promise<RResult>>(),
      cleanup: null,
      runSequence: 0,
      latestRunSequence: 0,
      stopped: false,
      destroyed: false,
      unit: {} as ActionUnit<TPayload, RResult, UUpdate>,
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

      const clearEntityMode = (): void => {
        internal.hasEntityValue = false;
        internal.membershipIds = [];
        entity.clearUnitMembership(internal.key);
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

    const executeRun = (
      payloadInput?: TPayload | InputUpdater<TPayload>,
    ): Promise<RResult> => {
        if (internal.destroyed) {
          return Promise.resolve(internal.state.value);
        }

      internal.payload = resolveInput(internal.payload, payloadInput);
      const payloadKey = serializeKey(internal.payload);
      const inFlightForPayload = internal.inFlightByPayload.get(payloadKey);
      if (inFlightForPayload) {
        return inFlightForPayload;
      }

        internal.stopped = false;
      internal.runSequence += 1;
      internal.latestRunSequence = internal.runSequence;
      const runSequence = internal.runSequence;
      const isLatestRun = () => {
        return internal.latestRunSequence === runSequence && !internal.destroyed;
      };

      if (isLatestRun()) {
        internal.state.status = 'loading';
        internal.state.context = null;
        notifyUnit(internal);
      }

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

        const applyRunValue = (nextValue: RResult | void): void => {
          if (!isLatestRun()) {
            return;
          }

          if (nextValue === undefined) {
            internal.state.value = getModeValue(internal, entity);
            return;
          }

          if (isEntityArray<TEntity>(nextValue)) {
            const upsertedEntities = entity.upsertMany(nextValue);
            setManyMode(upsertedEntities);
            internal.state.value = getModeValue(internal, entity);
            return;
          }

          if (isEntityValue<TEntity>(nextValue)) {
            const upsertedEntity = entity.upsertOne(nextValue);
            setOneMode(upsertedEntity);
            internal.state.value = getModeValue(internal, entity);
            return;
          }

          clearEntityMode();
          internal.state.value = nextValue;
        };

        const runContextBase = {
          scope: internal.scope,
          payload: internal.payload,
          setMeta: (metaInput: unknown) => {
            if (!isLatestRun()) {
              return;
            }

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

        const runContext = runContextBase as ActionRunContext<
          TInput,
          TPayload,
          TEntity,
          RResult,
          TEntityId
        >;

        const runPromise: Promise<RResult> = Promise.resolve(run(runContext))
          .then((result) => {
            if (!isLatestRun() && isActionCleanup(result)) {
              invokeActionCleanup(result);
              return internal.state.value;
            }

            if (isActionCleanup(result)) {
              if (internal.destroyed || internal.stopped) {
                invokeActionCleanup(result);
              } else {
                invokeActionCleanup(internal.cleanup);
                internal.cleanup = result;
              }

              if (isLatestRun()) {
                internal.state.value = getModeValue(internal, entity);
              }
            } else if (isLatestRun()) {
              applyRunValue(result);
            }

            if (isLatestRun()) {
              internal.state.status = 'success';
              internal.state.context = null;
              notifyUnit(internal);
            }

            return internal.state.value;
          })
          .catch((error: unknown) => {
            if (isLatestRun()) {
              internal.state.status = 'error';
              internal.state.context = error;
              notifyUnit(internal);
            }
            throw error;
          })
          .finally(() => {
            if (isLatestRun() && internal.inFlight === runPromise) {
              internal.inFlight = null;
            }
            internal.inFlightByPayload.delete(payloadKey);
          });

        internal.inFlight = runPromise;
        internal.inFlightByPayload.set(payloadKey, runPromise);

        return runPromise;
      };

    const unit = ((payloadInput?: TPayload | InputUpdater<TPayload>) => {
      internal.payload = resolveInput(internal.payload, payloadInput);
      return unit;
    }) as ActionUnit<TPayload, RResult, UUpdate>;

    unit.destroyDelay = destroyDelay;
    unit.run = (payloadInput) => executeRun(payloadInput);
    unit.get = () => {
      internal.state.value = getModeValue(internal, entity);
      return internal.state.value;
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
    unit.stop = () => {
      if (internal.destroyed) {
        return;
      }

      internal.runSequence += 1;
      internal.latestRunSequence = internal.runSequence;
      internal.stopped = true;
      invokeActionCleanup(internal.cleanup);
      internal.cleanup = null;
    };
    unit.destroy = () => {
      if (internal.destroyed) {
        return;
      }

      internal.runSequence += 1;
      internal.latestRunSequence = internal.runSequence;
      internal.stopped = true;
      invokeActionCleanup(internal.cleanup);
      internal.cleanup = null;
      internal.destroyed = true;

      unregisterFromEntity();
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

  return actionFactory;
};
