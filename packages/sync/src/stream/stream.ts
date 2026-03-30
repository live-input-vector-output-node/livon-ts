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
  Stream,
  StreamBuilder,
  StreamBuilderInput,
  StreamByEntityModeBuilder,
  StreamConfig,
  StreamRunConfig,
  StreamRun,
  StreamRunInput,
  StreamRunContext,
  StreamRunContextEntry,
  StreamSnapshot,
  StreamUnit,
  StreamUnitByKeyMap,
  StreamUnitInternal,
} from './types.js';

const STREAM_RUN_RESULT_ERROR = 'stream.run() must return void or a cleanup function.';
const resolveStreamFunctionKey = createFunctionKeyResolver({
  prefix: 'stream-fallback',
});

const createStreamFromConfig = <
  TIdentity extends object | undefined,
  TPayload,
  TMeta,
  TEntityStore extends Entity<object, EntityId>,
  TMode extends UnitEntityMode,
>(
{
  entity,
  mode,
}: StreamBuilderInput<TEntityStore, TMode>,
{
  key: streamKey,
  destroyDelay = entity.destroyDelay ?? DEFAULT_UNIT_DESTROY_DELAY,
  run,
  defaultValue,
}: StreamConfig<TIdentity, TPayload, EntityValueOfStore<TEntityStore>, TMode, TMeta>,
): Stream<TIdentity, TPayload, UnitDataByEntityMode<EntityValueOfStore<TEntityStore>, TMode>, TMeta> => {
  type TEntity = EntityValueOfStore<TEntityStore>;
  type TData = UnitDataByEntityMode<TEntity, TMode>;
  const unitsByKey: StreamUnitByKeyMap<TIdentity, TPayload, TData, TMeta> =
    new Map<string, StreamUnitInternal<TIdentity, TPayload, TData, TMeta>>();
  const unitKeyCache = createSerializedKeyCache({
    mode: 'identity-unit',
  });
  const resolvedStreamFunctionKey = resolveStreamFunctionKey(streamKey);
  const {
    mode: resolvedEntityMode,
    modeLocked: resolvedModeLocked,
  } = resolveUnitMode({
    entityMode: mode,
    defaultValue,
  });
  const entityFunctionKey = resolveEntityFunctionKey({
    entityKey: entity.key,
    functionKey: resolvedStreamFunctionKey,
  });

  const streamFactory: Stream<TIdentity, TPayload, TData, TMeta> = (identity) => {
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

    const internal: StreamUnitInternal<TIdentity, TPayload, TData, TMeta> = {
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
      stopCallback: null,
      started: false,
      destroyed: false,
      unit: {} as StreamUnit<TPayload, TData, TMeta>,
    };
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

    let runConfig: StreamRunConfig | undefined;
    const createRunContextEntry = (
      payload: TPayload,
    ): StreamRunContextEntry<TIdentity, TPayload, TData, TMeta, TEntity> => {
      const runContextMethods = createEntityRunContextMethods<
        TEntity,
        TData,
        EntityId
      >({
        entity,
        state: internal,
        isActive: () => true,
        refreshValue: refreshValueFromEntity,
        readValue: () => internal.state.value,
        refreshOnGet: true,
      });
      const runContextBase: StreamRunContext<
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
        context: runContextBase,
      };
    };
      const runContextEntryCache = createRunContextEntryCache<
      TPayload,
      StreamRunContextEntry<TIdentity, TPayload, TData, TMeta, TEntity>
    >({
      createEntry: createRunContextEntry,
      limit: DEFAULT_RUN_CONTEXT_CACHE_LIMIT,
    });

      entity.registerUnit({
        key: internal.key,
        onChange: () => {
          if (internal.destroyed) {
            return;
          }

          notifyUnit();
        },
      });

      const runWithPayload = (eventPayload: TPayload): Promise<TData> => {
        if (internal.destroyed) {
          return Promise.resolve(internal.state.value);
        }

        internal.state.status = 'loading';
        internal.state.context = null;
        notifyUnit(false);

        const runContextEntry = runContextEntryCache.getOrCreate(eventPayload);
        runContextEntry.context.payload = eventPayload;
        runContextEntry.context.value = internal.state.value;
        runContextEntry.context.status = internal.state.status;
        runContextEntry.context.meta = internal.state.meta;
        runContextEntry.context.context = internal.state.context;

        return Promise.resolve(run(runContextEntry.context))
          .then((result) => {
            if (isCleanup(result)) {
              if (internal.destroyed || !internal.started) {
                invokeCleanup(result);
              } else {
                internal.stopCallback = result;
              }

              refreshValueFromEntity();
              internal.state.status = 'success';
              internal.state.context = null;
              notifyUnit(false);

              return internal.state.value;
            }

            if (result !== undefined) {
              throw new TypeError(STREAM_RUN_RESULT_ERROR);
            }

            internal.state.status = 'success';
            internal.state.context = null;
            notifyUnit(false);

            return internal.state.value;
          })
          .catch((error: unknown) => {
            internal.state.status = 'error';
            internal.state.context = error;
            notifyUnit(false);
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
    const startUnit: StreamRun<TPayload, TData, TMeta> = (
      input?: StreamRunInput<TPayload, TData, TMeta>,
      config?: StreamRunConfig,
    ) => {
        if (internal.destroyed) {
          return Promise.resolve();
        }

        if (config) {
          runConfig = config;
        }

        let payloadInput: TPayload | undefined;
        if (isUnitSetAction<TPayload, StreamRunConfig, TData, TMeta | null>(input)) {
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
          payloadInput = input(previous, config);
        } else {
          payloadInput = input;
        }

        internal.payload = resolveInput(internal.payload, payloadInput);
        if (internal.started) {
          stop();
        }

        internal.started = true;
        return runWithPayload(internal.payload).then(resolveUnitRunAsVoid);
      };
    let streamSnapshotCache: StreamSnapshot<TPayload, TData, TMeta> | null = null;
    let streamSnapshotBaseCache = snapshotCache;
    const getSnapshot = (): StreamSnapshot<TPayload, TData, TMeta> => {
      refreshValueFromEntity();
      const baseSnapshot = readSnapshot();
      if (streamSnapshotCache && Object.is(streamSnapshotBaseCache, baseSnapshot)) {
        return streamSnapshotCache;
      }

      streamSnapshotBaseCache = baseSnapshot;
      streamSnapshotCache = {
        ...baseSnapshot,
        start: startUnit,
        stop,
      };
      return streamSnapshotCache;
    };
    const unit: StreamUnit<TPayload, TData, TMeta> = {
      getSnapshot,
      subscribe,
    };

    internal.unit = unit;
    unitsByKey.set(unitKey, internal);

      return unit;
  };

  return streamFactory;
};

export const stream: StreamBuilder = <
  TEntityStore extends Entity<object, EntityId>,
  TMode extends UnitEntityMode,
>({
  entity,
  mode,
}: StreamBuilderInput<TEntityStore, TMode>): StreamByEntityModeBuilder<TEntityStore, TMode> => {
  const streamByEntityMode: StreamByEntityModeBuilder<TEntityStore, TMode> = <
    TIdentity extends object | undefined,
    TPayload,
    TMeta,
  >(
    config: StreamConfig<
      TIdentity,
      TPayload,
      EntityValueOfStore<TEntityStore>,
      TMode,
      TMeta
    >,
  ) => {
    return createStreamFromConfig({
      entity,
      mode,
    }, config);
  };

  return streamByEntityMode;
};
