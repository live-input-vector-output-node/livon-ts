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
  UUpdate extends RResult,
  TEntityId extends EntityId = string,
> {
  entity: Entity<TEntity, TEntityId>;
  destroyDelay?: number;
  run: (
    context: ActionRunContext<TInput, TPayload, TEntity, RResult, TEntityId>,
  ) => Promise<ActionRunResult<RResult>> | ActionRunResult<RResult>;
  defaultValue?: RResult;
  update?: (current: RResult, update: UUpdate) => RResult;
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
  set: (input: UUpdate | ValueUpdater<RResult, UUpdate>) => void;
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
  mode: 'raw' | 'one' | 'many';
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
  update,
}: ActionConfig<TInput, TPayload, TEntity, RResult, UUpdate, TEntityId>,
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
    const key = stableSerialize(scope);
    const existingUnit = unitsByKey.get(key);

    if (existingUnit) {
      return existingUnit.unit;
    }

    const initialValue = (defaultValue ?? null) as RResult;

    const internal: ActionUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate> = {
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
        inFlight: null,
        inFlightByPayload: new Map<string, Promise<RResult>>(),
        cleanup: null,
        runSequence: 0,
        latestRunSequence: 0,
        stopped: false,
        destroyed: false,
      unit: {} as ActionUnit<TPayload, RResult, UUpdate>,
    };

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

    const executeRun = (
      payloadInput?: TPayload | InputUpdater<TPayload>,
    ): Promise<RResult> => {
        if (internal.destroyed) {
          return Promise.resolve(internal.state.value);
        }

      internal.payload = resolveInput(internal.payload, payloadInput);
      const payloadKey = stableSerialize(internal.payload);
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

        const runContext: ActionRunContext<TInput, TPayload, TEntity, RResult, TEntityId> = {
          scope: internal.scope,
          payload: internal.payload,
          setMeta: (meta) => {
            if (!isLatestRun()) {
              return;
            }

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
          getValue: () => {
            internal.state.value = getModeValue(internal, entity);
            return internal.state.value;
          },
        };

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
            } else if (result !== undefined) {
              if (isLatestRun()) {
                setRawMode();
                internal.state.value = result as RResult;
              }
            } else if (isLatestRun()) {
              internal.state.value = getModeValue(internal, entity);
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

      internal.unit = unit;
      unitsByKey.set(key, internal);

      return unit;
  };

  return actionFactory;
};
