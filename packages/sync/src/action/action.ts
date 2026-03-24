import { type EntityId, type UpsertOptions } from '../entity.js';
import {
  clearEntityMembership,
  createDependencyCache,
  createUnitSnapshot,
  getModeValue,
  isEntityArray,
  isEntityValue,
  notifyEffectListeners,
  resolveInput,
  resolveValue,
  setManyEntityMembership,
  setOneEntityMembership,
  serializeKey,
  type EffectListener,
  type InputUpdater,
} from '../utils/index.js';
import {
  invokeActionCleanup,
  isActionCleanup,
} from './helpers.js';
import type {
  Action,
  ActionConfig,
  ActionRunContext,
  ActionRunContextEntry,
  ActionRunGate,
  ActionUnit,
  ActionUnitByKeyMap,
  ActionUnitInternal,
} from './types.js';

const DEFAULT_DESTROY_DELAY = 250;
const RUN_CONTEXT_CACHE_LIMIT = 32;

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
  const runContextCache = createDependencyCache<
    ActionRunContextEntry<TInput, TPayload, TEntity, RResult, TEntityId>
  >({
    limit: RUN_CONTEXT_CACHE_LIMIT,
  });
  const readEntityValueById = entity.getById;

  const notifyUnit = (
    internal: ActionUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>,
  ): void => {
    internal.state.value = getModeValue(internal, readEntityValueById);

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
      inFlightByPayload: new Map<string, Promise<RResult>>(),
      cleanup: null,
      runSequence: 0,
      latestRunSequence: 0,
      stopped: false,
      destroyed: false,
      unit: {} as ActionUnit<TPayload, RResult, UUpdate>,
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

      const destroyInternal = (): void => {
        if (internal.destroyed) {
          return;
        }

        internal.runSequence += 1;
        internal.latestRunSequence = internal.runSequence;
        internal.stopped = true;
        invokeActionCleanup(internal.cleanup);
        internal.cleanup = null;
        internal.destroyed = true;
        runContextCache.clearPrimary({
          primaryDependencies: [internal.key],
        });

        unregisterFromEntity();
        internal.listeners.clear();
        unitsByKey.delete(internal.key);
      };

      const createRunContextEntry = (
        payload: TPayload,
      ): ActionRunContextEntry<TInput, TPayload, TEntity, RResult, TEntityId> => {
        const gate: ActionRunGate = {
          isLatestRun: () => false,
        };
        const upsertOne = (input: TEntity, options?: UpsertOptions): TEntity => {
          if (!gate.isLatestRun()) {
            return input;
          }

          const updated = entity.upsertOne(input, options);
          setOneEntityMembership(internal, { entity, value: updated });
          internal.state.value = getModeValue(internal, readEntityValueById);
          return updated;
        };
        const upsertMany = (
          input: readonly TEntity[],
          options?: UpsertOptions,
        ): readonly TEntity[] => {
          if (!gate.isLatestRun()) {
            return input;
          }

          const updated = entity.upsertMany(input, options);
          setManyEntityMembership(internal, { entity, values: updated });
          internal.state.value = getModeValue(internal, readEntityValueById);
          return updated;
        };
        const removeOne = (id: TEntityId): boolean => {
          if (!gate.isLatestRun()) {
            return false;
          }

          const removed = entity.removeOne(id);
          internal.state.value = getModeValue(internal, readEntityValueById);
          return removed;
        };
        const removeMany = (ids: readonly TEntityId[]): readonly TEntityId[] => {
          if (!gate.isLatestRun()) {
            return [];
          }

          const removedIds = entity.removeMany(ids);
          internal.state.value = getModeValue(internal, readEntityValueById);
          return removedIds;
        };
        const runContextBase: ActionRunContext<
          TInput,
          TPayload,
          TEntity,
          RResult,
          TEntityId
        > = {
          scope: internal.scope,
          payload,
          setMeta: (metaInput: unknown) => {
            if (!gate.isLatestRun()) {
              return;
            }

            const nextMeta = resolveValue(
              internal.state.meta,
              metaInput,
            );
            if (Object.is(nextMeta, internal.state.meta)) {
              return;
            }

            internal.state.meta = nextMeta;
            notifyUnit(internal);
          },
          upsertOne,
          upsertMany,
          removeOne,
          removeMany,
          getValue: () => {
            internal.state.value = getModeValue(internal, readEntityValueById);
            return internal.state.value;
          },
        };

        return {
          gate,
          context: runContextBase,
        };
      };

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

        const applyRunValue = (nextValue: RResult | void): void => {
          if (!isLatestRun()) {
            return;
          }

          if (nextValue === undefined) {
            internal.state.value = getModeValue(internal, readEntityValueById);
            return;
          }

          if (isEntityArray<TEntity>(nextValue)) {
            const upsertedEntities = entity.upsertMany(nextValue);
            setManyEntityMembership(internal, { entity, values: upsertedEntities });
            internal.state.value = getModeValue(internal, readEntityValueById);
            return;
          }

          if (isEntityValue<TEntity>(nextValue)) {
            const upsertedEntity = entity.upsertOne(nextValue);
            setOneEntityMembership(internal, { entity, value: upsertedEntity });
            internal.state.value = getModeValue(internal, readEntityValueById);
            return;
          }

          clearEntityMembership(internal, { clearUnitMembership: entity.clearUnitMembership });
          internal.state.value = nextValue;
        };

        const runContextEntry = runContextCache.getOrCreate({
          primaryDependencies: [internal.key],
          secondaryDependencies: [payloadKey],
          build: () => {
            return createRunContextEntry(internal.payload);
          },
        });
        runContextEntry.gate.isLatestRun = isLatestRun;
        runContextEntry.context.payload = internal.payload;

        const runPromise: Promise<RResult> = Promise.resolve(run(runContextEntry.context))
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
                internal.state.value = getModeValue(internal, readEntityValueById);
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
            internal.inFlightByPayload.delete(payloadKey);
          });

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
      internal.state.value = getModeValue(internal, readEntityValueById);
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
      destroyInternal();
    };

    Object.defineProperty(unit, 'getSnapshot', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: () => {
        internal.state.value = getModeValue(internal, readEntityValueById);
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
