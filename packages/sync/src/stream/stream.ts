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
  isStreamCleanup,
} from './helpers.js';
import type {
  Stream,
  StreamConfig,
  StreamRunContext,
  StreamRunContextEntry,
  StreamUnit,
  StreamUnitByKeyMap,
  StreamUnitInternal,
} from './types.js';

const DEFAULT_DESTROY_DELAY = 250;
const RUN_CONTEXT_CACHE_LIMIT = 32;

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
}: StreamConfig<
  TInput,
  TPayload,
  TEntity,
  RResult,
  TEntityId
>,
): Stream<TInput, TPayload, RResult, UUpdate> => {
  const unitsByKey: StreamUnitByKeyMap<TInput, TPayload, TEntityId, RResult, UUpdate> =
    new Map<string, StreamUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>>();
  const runContextCache = createDependencyCache<
    StreamRunContextEntry<TInput, TPayload, TEntity, RResult, TEntityId>
  >({
    limit: RUN_CONTEXT_CACHE_LIMIT,
  });
  const readEntityValueById = entity.getById;

  const notifyUnit = (
    internal: StreamUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>,
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
      const createRunContextEntry = (
        payload: TPayload,
      ): StreamRunContextEntry<TInput, TPayload, TEntity, RResult, TEntityId> => {
        const upsertOne = (input: TEntity, options?: UpsertOptions): TEntity => {
          const updated = entity.upsertOne(input, options);
          setOneEntityMembership(internal, { entity, value: updated });
          internal.state.value = getModeValue(internal, readEntityValueById);
          return updated;
        };
        const upsertMany = (
          input: readonly TEntity[],
          options?: UpsertOptions,
        ): readonly TEntity[] => {
          const updated = entity.upsertMany(input, options);
          setManyEntityMembership(internal, { entity, values: updated });
          internal.state.value = getModeValue(internal, readEntityValueById);
          return updated;
        };
        const removeOne = (id: TEntityId): boolean => {
          const removed = entity.removeOne(id);
          internal.state.value = getModeValue(internal, readEntityValueById);
          return removed;
        };
        const removeMany = (ids: readonly TEntityId[]): readonly TEntityId[] => {
          const removedIds = entity.removeMany(ids);
          internal.state.value = getModeValue(internal, readEntityValueById);
          return removedIds;
        };
        const runContextBase: StreamRunContext<
          TInput,
          TPayload,
          TEntity,
          RResult,
          TEntityId
        > = {
          scope: internal.scope,
          payload,
          setMeta: (metaInput: unknown) => {
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
          context: runContextBase,
        };
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

        internal.destroyed = true;
        runContextCache.clearPrimary({
          primaryDependencies: [internal.key],
        });
        unregisterFromEntity();
        stop();
        internal.listeners.clear();
        unitsByKey.delete(internal.key);
      };

      const runWithPayload = (eventPayload: TPayload): Promise<RResult> => {
        if (internal.destroyed) {
          return Promise.resolve(internal.state.value);
        }

        internal.state.status = 'loading';
        internal.state.context = null;
        notifyUnit(internal);

        const applyRunValue = (nextValue: RResult | void): void => {
          if (internal.destroyed) {
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

        const payloadKey = serializeKey(eventPayload);
        const runContextEntry = runContextCache.getOrCreate({
          primaryDependencies: [internal.key],
          secondaryDependencies: [payloadKey],
          build: () => {
            return createRunContextEntry(eventPayload);
          },
        });
        runContextEntry.context.payload = eventPayload;

        return Promise.resolve(run(runContextEntry.context))
          .then((result) => {
            if (isStreamCleanup(result)) {
              if (internal.destroyed || !internal.started) {
                result();
              } else {
                internal.stopCallback = result;
              }

              internal.state.value = getModeValue(internal, readEntityValueById);
              internal.state.status = 'success';
              internal.state.context = null;
              notifyUnit(internal);

              return internal.state.value;
            }

            applyRunValue(result);

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

  return streamFactory;
};
