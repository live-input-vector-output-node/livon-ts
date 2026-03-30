import { type EntityId } from '../entity.js';
import {
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
  invokeActionCleanup,
  isActionCleanup,
} from './helpers.js';
import type {
  Action,
  ActionConfig,
  ActionRunConfig,
  ActionRunInput,
  ActionRun,
  ActionRunContext,
  ActionRunContextEntry,
  ActionRunGate,
  ActionSetAction,
  ActionUnit,
  ActionUnitByKeyMap,
  ActionUnitInternal,
} from './types.js';

const DEFAULT_DESTROY_DELAY = 250;
const RUN_CONTEXT_CACHE_LIMIT = 32;
const ACTION_RUN_RESULT_ERROR = 'action.run() must return void or a cleanup function.';
const resolveRunAsVoid = (): void => undefined;

const isActionSetAction = <
  TPayload,
  TData,
  TMeta,
>(
  input: unknown,
): input is ActionSetAction<TPayload, TData, TMeta> => {
  return typeof input === 'function';
};

export const action = <
  TIdentity extends object | undefined,
  TPayload = unknown,
  TData = unknown,
  TMeta = unknown,
>({
  entity,
  destroyDelay = entity.destroyDelay ?? DEFAULT_DESTROY_DELAY,
  run,
  defaultValue,
}: ActionConfig<TIdentity, TPayload, TData, TMeta>,
): Action<TIdentity, TPayload, TData, TMeta> => {
  const unitsByKey: ActionUnitByKeyMap<TIdentity, TPayload, TData, TMeta> =
    new Map<string, ActionUnitInternal<TIdentity, TPayload, TData, TMeta>>();
  const readEntityValueById = entity.getById;
  const unitKeyCache = createSerializedKeyCache({
    mode: 'scoped-unit',
  });

  const actionFactory: Action<TIdentity, TPayload, TData, TMeta> = (identity) => {
    const key = unitKeyCache.getOrCreateKey(identity);
    const existingUnit = unitsByKey.get(key);

    if (existingUnit) {
      return existingUnit.unit;
    }

    const initialValue = (defaultValue ?? null) as TData;
    const initialMode: 'one' | 'many' = Array.isArray(initialValue) ? 'many' : 'one';

    const internal: ActionUnitInternal<TIdentity, TPayload, TData, TMeta> = {
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
      inFlightByPayload: new Map<string, Promise<TData>>(),
      cleanup: null,
      runSequence: 0,
      latestRunSequence: 0,
      stopped: false,
      destroyed: false,
      unit: {} as ActionUnit<TPayload, TData, TMeta>,
    };
    const payloadKeyCache = createSerializedKeyCache({
      mode: 'payload-hot-path',
      limit: RUN_CONTEXT_CACHE_LIMIT,
    });
    const refreshValueFromEntity = (): void => {
      internal.state.value = getModeValue(internal, readEntityValueById);
    };

    const notifyUnit = (refreshValue = true): void => {
      if (refreshValue) {
        refreshValueFromEntity();
      }
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

      entity.registerUnit({
        key: internal.key,
        onChange: () => {
          if (internal.destroyed) {
            return;
          }

          notifyUnit();
        },
      });

      const createRunContextEntry = (
        payload: TPayload,
      ): ActionRunContextEntry<TIdentity, TPayload, TData, TMeta> => {
        const gate: ActionRunGate = {
          isLatestRun: () => false,
        };
        const runContextMethods = createEntityRunContextMethods<
          UnitDataEntity<TData>,
          TData,
          EntityId
        >({
          entity,
          state: internal,
          isActive: () => gate.isLatestRun(),
          refreshValue: refreshValueFromEntity,
          readValue: () => internal.state.value,
          refreshOnGet: true,
        });
        const runContextBase: ActionRunContext<
          TIdentity,
          TPayload,
          TData,
          TMeta
        > = {
          identity: internal.identity,
          payload,
          setMeta: (metaInput: TMeta | null | ValueUpdater<TMeta | null, TMeta | null>) => {
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
            notifyUnit(false);
          },
          ...runContextMethods,
        };

        return {
          gate,
          context: runContextBase,
        };
      };
      const runContextEntryCache = createRunContextEntryCache<
        TPayload,
        ActionRunContextEntry<TIdentity, TPayload, TData, TMeta>
      >({
        createEntry: createRunContextEntry,
        limit: RUN_CONTEXT_CACHE_LIMIT,
      });

      let singleInFlightPromise: Promise<TData> | null = null;
      let hasSingleInFlightPayload = false;
      let singleInFlightPayload: TPayload | undefined;
      let singleInFlightPayloadKey: string | null = null;
      let runConfig: ActionRunConfig | undefined;

      const executeRun = (
        payloadInput?: TPayload,
      ): Promise<TData> => {
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
          notifyUnit(false);
        }

        const runContextEntry = runContextEntryCache.getOrCreate(internal.payload);
        runContextEntry.gate.isLatestRun = isLatestRun;
        runContextEntry.context.payload = internal.payload;

        const usesSingleInFlight = singleInFlightPromise === null && internal.inFlightByPayload.size === 0;
        const trackedPayloadKey = usesSingleInFlight
          ? null
          : (payloadKey ?? payloadKeyCache.getOrCreateKey(internal.payload));

        const runPromise: Promise<TData> = Promise.resolve(run(runContextEntry.context))
          .then((result) => {
            if (isActionCleanup(result)) {
              if (!isLatestRun()) {
                invokeActionCleanup(result);
                return internal.state.value;
              }

              if (internal.destroyed || internal.stopped) {
                invokeActionCleanup(result);
              } else {
                invokeActionCleanup(internal.cleanup);
                internal.cleanup = result;
              }

              if (isLatestRun()) {
                refreshValueFromEntity();
              }
            } else if (result !== undefined) {
              throw new TypeError(ACTION_RUN_RESULT_ERROR);
            }

            if (isLatestRun()) {
              internal.state.status = 'success';
              internal.state.context = null;
              notifyUnit(false);
            }

            return internal.state.value;
          })
          .catch((error: unknown) => {
            if (isLatestRun()) {
              internal.state.status = 'error';
              internal.state.context = error;
              notifyUnit(false);
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

    const getSnapshot = () => {
      refreshValueFromEntity();
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
      };
    };
    const runUnit: ActionRun<TPayload, TData, TMeta> = (
      input?: ActionRunInput<TPayload, TData, TMeta>,
      config?: ActionRunConfig,
    ) => {
        if (config) {
          runConfig = config;
        }

        let payloadInput: TPayload | undefined;
        if (isActionSetAction<TPayload, TData, TMeta>(input)) {
          const previous: UnitRunPrevious<
            TPayload,
            ActionRunConfig,
            TData,
            TMeta | null
          > = {
            snapshot: getSnapshot(),
            data: internal.payload,
            config: runConfig,
          };
          payloadInput = input(previous, config);
        } else {
          payloadInput = input;
        }

        return executeRun(payloadInput).then(resolveRunAsVoid);
      };
    const unit: ActionUnit<TPayload, TData, TMeta> = {
      run: runUnit,
      getSnapshot,
      subscribe,
    };

      internal.unit = unit;
      unitsByKey.set(key, internal);

      return unit;
  };

  return actionFactory;
};
