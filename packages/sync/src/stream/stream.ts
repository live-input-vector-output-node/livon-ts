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
  type UnitRunPrevious,
  type UnitDataEntity,
  type ValueUpdater,
} from '../utils/index.js';
import {
  isStreamCleanup,
} from './helpers.js';
import type {
  Stream,
  StreamConfig,
  StreamRunConfig,
  StreamRun,
  StreamRunInput,
  StreamRunContext,
  StreamRunContextEntry,
  StreamSetAction,
  StreamUnit,
  StreamUnitByKeyMap,
  StreamUnitInternal,
} from './types.js';

const DEFAULT_DESTROY_DELAY = 250;
const RUN_CONTEXT_CACHE_LIMIT = 32;

const isStreamSetAction = <
  TPayload,
  TData,
  TMeta,
>(
  input: unknown,
): input is StreamSetAction<TPayload, TData, TMeta> => {
  return typeof input === 'function';
};

interface ResolveStreamRunInputInput<
  TPayload,
  TData,
  TMeta,
> {
  input: StreamRunInput<TPayload, TData, TMeta> | undefined;
  config: StreamRunConfig | undefined;
  previous: UnitRunPrevious<TPayload, StreamRunConfig, TData, TMeta | null>;
}

const resolveStreamRunInput = <
  TPayload,
  TData,
  TMeta,
>(
  {
    input,
    config,
    previous,
  }: ResolveStreamRunInputInput<TPayload, TData, TMeta>,
): TPayload | undefined => {
  if (isStreamSetAction<TPayload, TData, TMeta>(input)) {
    return input(previous, config);
  }

  return input;
};

export const stream = <
  TIdentity extends object | undefined,
  TPayload = unknown,
  TData = unknown,
  TMeta = unknown,
>({
  entity,
  destroyDelay = entity.destroyDelay ?? DEFAULT_DESTROY_DELAY,
  run,
  defaultValue,
}: StreamConfig<TIdentity, TPayload, TData, TMeta>,
): Stream<TIdentity, TPayload, TData, TMeta> => {
  const unitsByKey: StreamUnitByKeyMap<TIdentity, TPayload, TData, TMeta> =
    new Map<string, StreamUnitInternal<TIdentity, TPayload, TData, TMeta>>();
  const readEntityValueById = entity.getById;
  const unitKeyCache = createSerializedKeyCache({
    mode: 'scoped-unit',
  });

  const notifyUnit = (
    internal: StreamUnitInternal<TIdentity, TPayload, TData, TMeta>,
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

  const streamFactory: Stream<TIdentity, TPayload, TData, TMeta> = (identity) => {
    const key = unitKeyCache.getOrCreateKey(identity);
    const existingUnit = unitsByKey.get(key);

    if (existingUnit) {
      return existingUnit.unit;
    }

    const initialValue = (defaultValue ?? null) as TData;
    const initialMode: 'one' | 'many' = Array.isArray(initialValue) ? 'many' : 'one';

    const internal: StreamUnitInternal<TIdentity, TPayload, TData, TMeta> = {
      key,
      destroyDelay,
      identity,
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
    let runConfig: StreamRunConfig | undefined;
    const createRunContextEntry = (
      payload: TPayload,
    ): StreamRunContextEntry<TIdentity, TPayload, TData, TMeta> => {
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
        TIdentity,
        TPayload,
        TData,
        TMeta
      > = {
        identity: internal.identity,
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
      StreamRunContextEntry<TIdentity, TPayload, TData, TMeta>
    >({
      createEntry: createRunContextEntry,
      limit: RUN_CONTEXT_CACHE_LIMIT,
    });

      entity.registerUnit({
        key: internal.key,
        onChange: () => {
          if (internal.destroyed) {
            return;
          }

          notifyUnit(internal);
        },
      });

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

    const getSnapshot = () => {
      internal.state.value = getModeValue(internal, readEntityValueById);
      return createUnitSnapshot({
        value: internal.state.value,
        status: internal.state.status,
        meta: internal.state.meta,
        context: internal.state.context,
      });
    };
    const subscribe = (listener: EffectListener<TData, TMeta | null>) => {
      if (internal.destroyed) {
        return undefined;
      }

      internal.listeners.add(listener);

      return () => {
        internal.listeners.delete(listener);
        if (internal.listeners.size === 0) {
          stop();
        }
      };
    };
    const runUnit: StreamRun<TPayload, TData, TMeta> = (
      input?: StreamRunInput<TPayload, TData, TMeta>,
      config?: StreamRunConfig,
    ) => {
        if (internal.destroyed) {
          return Promise.resolve();
        }

        if (config) {
          runConfig = config;
        }

        const previous: UnitRunPrevious<
          TPayload,
          StreamRunConfig,
          TData,
          TMeta | null
        > = {
          snapshot: getSnapshot(),
          data: internal.payload,
          config: runConfig,
        };
        const payloadInput = resolveStreamRunInput<TPayload, TData, TMeta>({
          input,
          config,
          previous,
        });
        internal.payload = resolveInput(internal.payload, payloadInput);
        if (internal.started) {
          stop();
        }

        internal.started = true;
        return runWithPayload(internal.payload).then(() => undefined);
      };
    const unit: StreamUnit<TPayload, TData, TMeta> = {
      run: runUnit,
      getSnapshot,
      subscribe,
    };

      internal.unit = unit;
      unitsByKey.set(key, internal);

      return unit;
  };

  return streamFactory;
};
