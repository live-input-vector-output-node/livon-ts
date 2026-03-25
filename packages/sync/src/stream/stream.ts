import { type EntityId } from '../entity.js';
import {
  applyEntityRunResult,
  createEntityRunContextMethods,
  createRunContextEntryCache,
  createSerializedKeyCache,
  createUnitSnapshot,
  getModeValue,
  notifyEffectListeners,
  resolveInput,
  resolveValue,
  type EffectListener,
  type InputUpdater,
  type UnitDataEntity,
  type ValueUpdater,
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
  TData = unknown,
  TMeta = unknown,
>({
  entity,
  destroyDelay = entity.destroyDelay ?? DEFAULT_DESTROY_DELAY,
  run,
  defaultValue,
}: StreamConfig<TInput, TPayload, TData, TMeta>,
): Stream<TInput, TPayload, TData, TMeta> => {
  const unitsByKey: StreamUnitByKeyMap<TInput, TPayload, TData, TMeta> =
    new Map<string, StreamUnitInternal<TInput, TPayload, TData, TMeta>>();
  const readEntityValueById = entity.getById;
  const unitKeyCache = createSerializedKeyCache({
    mode: 'scoped-unit',
  });

  const notifyUnit = (
    internal: StreamUnitInternal<TInput, TPayload, TData, TMeta>,
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

  const streamFactory: Stream<TInput, TPayload, TData, TMeta> = (scope) => {
    const key = unitKeyCache.getOrCreateKey(scope);
    const existingUnit = unitsByKey.get(key);

    if (existingUnit) {
      return existingUnit.unit;
    }

    const initialValue = (defaultValue ?? null) as TData;
    const initialMode: 'one' | 'many' = Array.isArray(initialValue) ? 'many' : 'one';

    const internal: StreamUnitInternal<TInput, TPayload, TData, TMeta> = {
      key,
      destroyDelay,
      scope,
      payload: undefined as TPayload,
      mode: initialMode,
      modeLocked: false,
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
      listeners: new Set<EffectListener<TData, TMeta | null>>(),
      stopCallback: null,
      started: false,
      destroyed: false,
      unit: {} as StreamUnit<TPayload, TData, TMeta>,
    };
    const createRunContextEntry = (
      payload: TPayload,
    ): StreamRunContextEntry<TInput, TPayload, TData, TMeta> => {
      const runContextMethods = createEntityRunContextMethods<
        UnitDataEntity<TData>,
        TData,
        EntityId
      >({
        entity,
        state: internal,
        isActive: () => true,
        refreshValue: () => {
          internal.state.value = getModeValue(internal, readEntityValueById);
        },
        readValue: () => internal.state.value,
        refreshOnGet: true,
      });
      const runContextBase: StreamRunContext<
        TInput,
        TPayload,
        TData,
        TMeta
      > = {
        scope: internal.scope,
        payload,
        setMeta: (metaInput: TMeta | null | ValueUpdater<TMeta | null, TMeta | null>) => {
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
        ...runContextMethods,
      };

      return {
        context: runContextBase,
      };
    };
    const runContextEntryCache = createRunContextEntryCache<
      TPayload,
      StreamRunContextEntry<TInput, TPayload, TData, TMeta>
    >({
      createEntry: createRunContextEntry,
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

        internal.destroyed = true;
        runContextEntryCache.clear();
        unregisterFromEntity();
        stop();
        internal.listeners.clear();
        unitsByKey.delete(internal.key);
      };

      const runWithPayload = (eventPayload: TPayload): Promise<TData> => {
        if (internal.destroyed) {
          return Promise.resolve(internal.state.value);
        }

        internal.state.status = 'loading';
        internal.state.context = null;
        notifyUnit(internal);

        const applyRunValue = (nextValue: TData | void): void => {
          if (internal.destroyed) {
            return;
          }

          applyEntityRunResult({
            entity,
            state: internal,
            nextValue,
            refreshValueFromMembership: () => {
              internal.state.value = getModeValue(internal, readEntityValueById);
            },
            setRawValue: (value) => {
              internal.state.value = value;
            },
          });
        };

        const runContextEntry = runContextEntryCache.getOrCreate(eventPayload);
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
    }) as StreamUnit<TPayload, TData, TMeta>;

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
