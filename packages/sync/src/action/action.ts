import {
  type Entity,
  type EntityId,
} from '../entity.js';
import {
  DEFAULT_RUN_CONTEXT_CACHE_LIMIT,
  DEFAULT_UNIT_DESTROY_DELAY,
  createEntityValueReader,
  createEntityRunContextMethods,
  createFunctionKeyResolver,
  createRunContextEntryCache,
  createSerializedKeyCache,
  createUnitSnapshot,
  getModeValue,
  invokeCleanup,
  isUnitSnapshotEqual,
  isCleanup,
  isUnitSetAction,
  notifyEffectListeners,
  resolveEntityFunctionIdentityKey,
  resolveEntityFunctionKey,
  resolveDefaultUnitValue,
  resolveInput,
  resolveUnitRunAsVoid,
  resolveUnitMode,
  resolveValue,
  type EntityValueOfStore,
  type EffectListener,
  type UnitDataByEntityMode,
  type UnitEntityMode,
  type UnitRunPrevious,
  type UnitSnapshot,
  type ValueUpdater,
} from '../utils/index.js';
import type {
  Action,
  ActionBuilder,
  ActionBuilderInput,
  ActionByEntityModeBuilder,
  ActionConfig,
  ActionRunConfig,
  ActionRunInput,
  ActionRun,
  ActionRunContext,
  ActionRunContextEntry,
  ActionRunGate,
  ActionSnapshot,
  ActionUnit,
  ActionUnitByKeyMap,
  ActionUnitInternal,
} from './types.js';

const ACTION_RUN_RESULT_ERROR = 'action.run() must return void or a cleanup function.';
const resolveActionFunctionKey = createFunctionKeyResolver({
  prefix: 'action-fallback',
});

const createActionFromConfig = <
  TIdentity extends object | undefined,
  TPayload,
  TMeta,
  TEntityStore extends Entity<object, EntityId>,
  TMode extends UnitEntityMode,
>(
{
  entity,
  mode,
}: ActionBuilderInput<TEntityStore, TMode>,
{
  key: actionKey,
  destroyDelay = entity.destroyDelay ?? DEFAULT_UNIT_DESTROY_DELAY,
  run,
  defaultValue,
}: ActionConfig<TIdentity, TPayload, EntityValueOfStore<TEntityStore>, TMode, TMeta>,
): Action<TIdentity, TPayload, UnitDataByEntityMode<EntityValueOfStore<TEntityStore>, TMode>, TMeta> => {
  type TEntity = EntityValueOfStore<TEntityStore>;
  type TData = UnitDataByEntityMode<TEntity, TMode>;
  const unitsByKey: ActionUnitByKeyMap<TIdentity, TPayload, TData, TMeta> =
    new Map<string, ActionUnitInternal<TIdentity, TPayload, TData, TMeta>>();
  const unitKeyCache = createSerializedKeyCache({
    mode: 'identity-unit',
  });
  const resolvedActionFunctionKey = resolveActionFunctionKey(actionKey);
  const {
    mode: resolvedEntityMode,
    modeLocked: resolvedModeLocked,
  } = resolveUnitMode({
    entityMode: mode,
    defaultValue,
  });
  const entityFunctionKey = resolveEntityFunctionKey({
    entityKey: entity.key,
    functionKey: resolvedActionFunctionKey,
  });

  const actionFactory: Action<TIdentity, TPayload, TData, TMeta> = (identity) => {
    const identityKey = unitKeyCache.getOrCreateKey(identity);
    const unitKey = resolveEntityFunctionIdentityKey({
      entityFunctionKey,
      identityKey,
    });
    const readEntityValueById = createEntityValueReader<TEntity, EntityId>({
      entity,
      identityKey,
      localIdentityKey: unitKey,
    });
    const existingUnit = unitsByKey.get(unitKey);

    if (existingUnit) {
      return existingUnit.unit;
    }

    const initialValue = resolveDefaultUnitValue({
      defaultValue,
      mode: resolvedEntityMode,
    }) as TData;
    const initialMode: 'one' | 'many' = resolvedEntityMode;

    const internal: ActionUnitInternal<TIdentity, TPayload, TData, TMeta> = {
      key: unitKey,
      destroyDelay,
      identity,
      payload: undefined as TPayload,
      mode: initialMode,
      modeLocked: resolvedModeLocked,
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
      limit: DEFAULT_RUN_CONTEXT_CACHE_LIMIT,
    });
    const refreshValueFromEntity = (): void => {
      internal.state.value = getModeValue(internal, readEntityValueById);
    };
    let snapshotCache: UnitSnapshot<TData, TMeta | null, unknown, TIdentity> = createUnitSnapshot({
      identity: internal.identity,
      value: internal.state.value,
      status: internal.state.status,
      meta: internal.state.meta,
      context: internal.state.context,
    });
    let lastNotifiedSnapshot = snapshotCache;

    const readSnapshot = (): UnitSnapshot<TData, TMeta | null, unknown, TIdentity> => {
      if (
        snapshotCache.status === internal.state.status
        && Object.is(snapshotCache.value, internal.state.value)
        && Object.is(snapshotCache.meta, internal.state.meta)
        && Object.is(snapshotCache.context, internal.state.context)
      ) {
        return snapshotCache;
      }

      if (isUnitSnapshotEqual({
        left: snapshotCache,
        right: internal.state,
      })) {
        return snapshotCache;
      }

      snapshotCache = createUnitSnapshot({
        identity: internal.identity,
        value: internal.state.value,
        status: internal.state.status,
        meta: internal.state.meta,
        context: internal.state.context,
      });
      return snapshotCache;
    };

    const notifyUnit = (refreshValue = true): void => {
      if (refreshValue) {
        refreshValueFromEntity();
      }

      if (internal.listeners.size === 0) {
        return;
      }

      const nextSnapshot = readSnapshot();
      if (Object.is(lastNotifiedSnapshot, nextSnapshot)) {
        return;
      }

      lastNotifiedSnapshot = nextSnapshot;
      notifyEffectListeners(
        internal.listeners,
        nextSnapshot,
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
      ): ActionRunContextEntry<TIdentity, TPayload, TData, TMeta, TEntity> => {
        const gate: ActionRunGate = {
          isLatestRun: () => false,
        };
        const runContextMethods = createEntityRunContextMethods<
          TEntity,
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
          TMeta,
          TEntity
        > = {
          identity: internal.identity,
          value: internal.state.value,
          status: internal.state.status,
          meta: internal.state.meta,
          context: internal.state.context,
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
            runContextBase.meta = nextMeta;
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
        ActionRunContextEntry<TIdentity, TPayload, TData, TMeta, TEntity>
      >({
        createEntry: createRunContextEntry,
        limit: DEFAULT_RUN_CONTEXT_CACHE_LIMIT,
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
        runContextEntry.context.value = internal.state.value;
        runContextEntry.context.status = internal.state.status;
        runContextEntry.context.meta = internal.state.meta;
        runContextEntry.context.context = internal.state.context;

        const usesSingleInFlight = singleInFlightPromise === null && internal.inFlightByPayload.size === 0;
        const trackedPayloadKey = usesSingleInFlight
          ? null
          : (payloadKey ?? payloadKeyCache.getOrCreateKey(internal.payload));

        const runPromise: Promise<TData> = Promise.resolve(run(runContextEntry.context))
          .then((result) => {
            if (isCleanup(result)) {
              if (!isLatestRun()) {
                invokeCleanup(result);
                return internal.state.value;
              }

              if (internal.destroyed || internal.stopped) {
                invokeCleanup(result);
              } else {
                invokeCleanup(internal.cleanup);
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

    const subscribe = (listener: EffectListener<TData, TMeta | null>) => {
      if (internal.destroyed) {
        return undefined;
      }

      internal.listeners.add(listener);

      return () => {
        internal.listeners.delete(listener);
      };
    };
    const executeUnit: ActionRun<TPayload, TData, TMeta> = (
      input?: ActionRunInput<TPayload, TData, TMeta>,
      config?: ActionRunConfig,
    ) => {
        if (config) {
          runConfig = config;
        }

        let payloadInput: TPayload | undefined;
        if (isUnitSetAction<TPayload, ActionRunConfig, TData, TMeta | null>(input)) {
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

        return executeRun(payloadInput).then(resolveUnitRunAsVoid);
    };
    let actionSnapshotCache: ActionSnapshot<TPayload, TData, TMeta> | null = null;
    let actionSnapshotBaseCache = snapshotCache;
    const getSnapshot = (): ActionSnapshot<TPayload, TData, TMeta> => {
      refreshValueFromEntity();
      const baseSnapshot = readSnapshot();
      if (actionSnapshotCache && Object.is(actionSnapshotBaseCache, baseSnapshot)) {
        return actionSnapshotCache;
      }

      actionSnapshotBaseCache = baseSnapshot;
      actionSnapshotCache = {
        ...baseSnapshot,
        submit: executeUnit,
      };
      return actionSnapshotCache;
    };
    const unit: ActionUnit<TPayload, TData, TMeta> = {
      getSnapshot,
      subscribe,
    };

    internal.unit = unit;
    unitsByKey.set(unitKey, internal);

      return unit;
  };

  return actionFactory;
};

export const action: ActionBuilder = <
  TEntityStore extends Entity<object, EntityId>,
  TMode extends UnitEntityMode,
>({
  entity,
  mode,
}: ActionBuilderInput<TEntityStore, TMode>): ActionByEntityModeBuilder<TEntityStore, TMode> => {
  const actionByEntityMode: ActionByEntityModeBuilder<TEntityStore, TMode> = <
    TIdentity extends object | undefined,
    TPayload,
    TMeta,
  >(
    config: ActionConfig<
      TIdentity,
      TPayload,
      EntityValueOfStore<TEntityStore>,
      TMode,
      TMeta
    >,
  ) => {
    return createActionFromConfig({
      entity,
      mode,
    }, config);
  };

  return actionByEntityMode;
};
