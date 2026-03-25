import { type EntityId, type UpsertOptions } from '../entity.js';
import {
  clearEntityMembership,
  createSerializedKeyCache,
  createUnitSnapshot,
  getModeValue,
  isEntityArray,
  isEntityValue,
  notifyEffectListeners,
  resolveInput,
  resolveValue,
  setManyEntityMembership,
  setOneEntityMembership,
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
  const readEntityValueById = entity.getById;
  const unitKeyCache = createSerializedKeyCache({
    mode: 'scoped-unit',
  });

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
    const key = unitKeyCache.getOrCreateKey(scope);
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
      readWrite: {
        subview: entity.readWrite.subview,
      },
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
    const runContextEntriesByPrimitivePayload = new Map<
      unknown,
      ActionRunContextEntry<TInput, TPayload, TEntity, RResult, TEntityId>
    >();
    const runContextPrimitivePayloadOrder = new Set<unknown>();
    let latestObjectPayload: object | null = null;
    let latestObjectRunContextEntry:
      | ActionRunContextEntry<TInput, TPayload, TEntity, RResult, TEntityId>
      | null = null;
    let previousObjectPayload: object | null = null;
    let previousObjectRunContextEntry:
      | ActionRunContextEntry<TInput, TPayload, TEntity, RResult, TEntityId>
      | null = null;
    const payloadKeyCache = createSerializedKeyCache({
      mode: 'payload-hot-path',
      limit: RUN_CONTEXT_CACHE_LIMIT,
    });

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
        runContextEntriesByPrimitivePayload.clear();
        runContextPrimitivePayloadOrder.clear();
        latestObjectPayload = null;
        latestObjectRunContextEntry = null;
        previousObjectPayload = null;
        previousObjectRunContextEntry = null;
        payloadKeyCache.clear();
        singleInFlightPromise = null;
        hasSingleInFlightPayload = false;
        singleInFlightPayload = undefined;
        singleInFlightPayloadKey = null;

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
      const getOrCreateRunContextEntry = (
        payload: TPayload,
      ): ActionRunContextEntry<TInput, TPayload, TEntity, RResult, TEntityId> => {
        if (payload !== null && typeof payload === 'object') {
          if (latestObjectPayload !== null && Object.is(latestObjectPayload, payload)) {
            if (!latestObjectRunContextEntry) {
              const createdRunContextEntry = createRunContextEntry(payload);
              latestObjectRunContextEntry = createdRunContextEntry;
              return createdRunContextEntry;
            }

            return latestObjectRunContextEntry;
          }

          if (previousObjectPayload !== null && Object.is(previousObjectPayload, payload)) {
            if (!previousObjectRunContextEntry) {
              const createdRunContextEntry = createRunContextEntry(payload);
              previousObjectRunContextEntry = createdRunContextEntry;
            }

            const promotedObjectPayload = previousObjectPayload;
            const promotedRunContextEntry = previousObjectRunContextEntry;
            previousObjectPayload = latestObjectPayload;
            previousObjectRunContextEntry = latestObjectRunContextEntry;
            latestObjectPayload = promotedObjectPayload;
            latestObjectRunContextEntry = promotedRunContextEntry;

            return promotedRunContextEntry;
          }

          const createdRunContextEntry = createRunContextEntry(payload);
          previousObjectPayload = latestObjectPayload;
          previousObjectRunContextEntry = latestObjectRunContextEntry;
          latestObjectPayload = payload;
          latestObjectRunContextEntry = createdRunContextEntry;
          return createdRunContextEntry;
        }

        const existingRunContextEntry = runContextEntriesByPrimitivePayload.get(payload);
        if (existingRunContextEntry) {
          runContextPrimitivePayloadOrder.delete(payload);
          runContextPrimitivePayloadOrder.add(payload);
          return existingRunContextEntry;
        }

        const createdRunContextEntry = createRunContextEntry(payload);
        runContextEntriesByPrimitivePayload.set(payload, createdRunContextEntry);
        runContextPrimitivePayloadOrder.add(payload);

        if (runContextEntriesByPrimitivePayload.size > RUN_CONTEXT_CACHE_LIMIT) {
          const oldestPayload = runContextPrimitivePayloadOrder.values().next().value;
          if (oldestPayload !== undefined) {
            runContextPrimitivePayloadOrder.delete(oldestPayload);
            runContextEntriesByPrimitivePayload.delete(oldestPayload);
          }
        }

        return createdRunContextEntry;
      };

      let singleInFlightPromise: Promise<RResult> | null = null;
      let hasSingleInFlightPayload = false;
      let singleInFlightPayload: TPayload | undefined;
      let singleInFlightPayloadKey: string | null = null;

      const executeRun = (
        payloadInput?: TPayload | InputUpdater<TPayload>,
      ): Promise<RResult> => {
        if (internal.destroyed) {
          return Promise.resolve(internal.state.value);
        }

        internal.payload = resolveInput(internal.payload, payloadInput);
        let payloadKey: string | null = null;
        if (singleInFlightPromise) {
          if (hasSingleInFlightPayload && Object.is(singleInFlightPayload, internal.payload)) {
            return singleInFlightPromise;
          }

          payloadKey = payloadKeyCache.getOrCreateKey(internal.payload);
          if (singleInFlightPayloadKey === null && hasSingleInFlightPayload) {
            singleInFlightPayloadKey = payloadKeyCache.getOrCreateKey(singleInFlightPayload);
          }

          if (singleInFlightPayloadKey === payloadKey) {
            return singleInFlightPromise;
          }
        }

        if (internal.inFlightByPayload.size > 0) {
          payloadKey ??= payloadKeyCache.getOrCreateKey(internal.payload);
          const inFlightForPayload = internal.inFlightByPayload.get(payloadKey);
          if (inFlightForPayload) {
            return inFlightForPayload;
          }
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

        const runContextEntry = getOrCreateRunContextEntry(internal.payload);
        runContextEntry.gate.isLatestRun = isLatestRun;
        runContextEntry.context.payload = internal.payload;

        const usesSingleInFlight = singleInFlightPromise === null && internal.inFlightByPayload.size === 0;
        const trackedPayloadKey = usesSingleInFlight
          ? null
          : (payloadKey ?? payloadKeyCache.getOrCreateKey(internal.payload));

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
            if (usesSingleInFlight) {
              if (singleInFlightPromise === runPromise) {
                singleInFlightPromise = null;
                hasSingleInFlightPayload = false;
                singleInFlightPayload = undefined;
                singleInFlightPayloadKey = null;
              }
              return;
            }

            if (trackedPayloadKey !== null) {
              internal.inFlightByPayload.delete(trackedPayloadKey);
            }
          });

        if (usesSingleInFlight) {
          singleInFlightPromise = runPromise;
          hasSingleInFlightPayload = true;
          singleInFlightPayload = internal.payload;
          singleInFlightPayloadKey = null;
        } else {
          if (trackedPayloadKey !== null) {
            internal.inFlightByPayload.set(trackedPayloadKey, runPromise);
          }
        }

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
