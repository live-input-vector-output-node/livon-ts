import type {
  Entity,
  EntityId,
} from './entity.js';
import { createSerializedKeyCache } from './utils/serializedKeyCache.js';
import type {
  EffectListener,
  UnitSnapshot,
} from './utils/types.js';
import type {
  EntityValueOfStore,
  UnitDataByEntityMode,
  UnitEntityMode,
} from './utils/index.js';
import {
  resolveDefaultUnitValue,
} from './utils/index.js';
import type {
  Stream,
  StreamBuilder,
  StreamBuilderInput,
  StreamByEntityModeBuilder,
  StreamConfig,
  StreamSnapshot,
  StreamRun,
  StreamRunInput,
  StreamUnit,
} from './stream/index.js';
import {
  shouldWarmupOnFirstRun,
} from './configureLazy.js';
import {
  loadLazyStreamModule,
} from './preload.js';

const createLazyStreamFromConfig = <
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
  config: StreamConfig<TIdentity, TPayload, EntityValueOfStore<TEntityStore>, TMode, TMeta>,
): Stream<TIdentity, TPayload, UnitDataByEntityMode<EntityValueOfStore<TEntityStore>, TMode>, TMeta> => {
  type TEntity = EntityValueOfStore<TEntityStore>;
  type TData = UnitDataByEntityMode<TEntity, TMode>;

  const identityKeyCache = createSerializedKeyCache({
    mode: 'identity-unit',
  });
  const unitByIdentityKey = new Map<string, StreamUnit<TPayload, TData, TMeta>>();
  let streamFactory: Stream<TIdentity, TPayload, TData, TMeta> | undefined;
  let streamFactoryPromise: Promise<Stream<TIdentity, TPayload, TData, TMeta>> | undefined;

  const ensureStreamFactory = (): Promise<Stream<TIdentity, TPayload, TData, TMeta>> => {
    if (streamFactory) {
      return Promise.resolve(streamFactory);
    }

    if (!streamFactoryPromise) {
      streamFactoryPromise = loadLazyStreamModule().then((module) => {
        const streamByEntityMode = module.stream<TEntityStore, TMode>({
          entity,
          mode,
        });
        const createdFactory = streamByEntityMode<TIdentity, TPayload, TMeta>(config);
        streamFactory = createdFactory;
        return createdFactory;
      });
    }

    if (!streamFactoryPromise) {
      throw new Error('Failed to initialize stream factory.');
    }
    return streamFactoryPromise;
  };

  if (shouldWarmupOnFirstRun()) {
    void ensureStreamFactory();
  }

  const streamFactoryLazy: Stream<TIdentity, TPayload, TData, TMeta> = (identity) => {
    const identityKey = identityKeyCache.getOrCreateKey(identity);
    const existingUnit = unitByIdentityKey.get(identityKey);
    if (existingUnit) {
      return existingUnit;
    }

    let resolvedUnit: StreamUnit<TPayload, TData, TMeta> | undefined;
    let resolvedUnitPromise: Promise<StreamUnit<TPayload, TData, TMeta>> | undefined;
    let bridgeAttached = false;
    let bridgeCleanup: (() => void) | undefined;
    const listeners = new Set<EffectListener<TData, TMeta | null>>();
    const initialValue = resolveDefaultUnitValue({
      defaultValue: config.defaultValue,
      mode,
    }) as TData;
    let snapshot: UnitSnapshot<TData, TMeta | null> = {
      identity,
      value: initialValue,
      status: 'idle',
      meta: null,
      context: null,
    };
    let streamSnapshotCache: StreamSnapshot<TPayload, TData, TMeta> | null = null;
    let streamSnapshotBaseCache = snapshot;

    const notifyListeners = (): void => {
      listeners.forEach((listener) => {
        listener(snapshot);
      });
    };

    const detachBridgeIfNeeded = (): void => {
      if (listeners.size > 0) {
        return;
      }

      if (!bridgeAttached) {
        return;
      }

      if (bridgeCleanup) {
        bridgeCleanup();
      }

      bridgeCleanup = undefined;
      bridgeAttached = false;
    };

    const attachBridgeIfNeeded = (): void => {
      if (!resolvedUnit || bridgeAttached || listeners.size === 0) {
        return;
      }

      const unsubscribe = resolvedUnit.subscribe((nextSnapshot) => {
        snapshot = nextSnapshot;
        notifyListeners();
      });

      if (typeof unsubscribe === 'function') {
        bridgeCleanup = unsubscribe;
      }

      bridgeAttached = true;
    };

    const ensureUnit = (): Promise<StreamUnit<TPayload, TData, TMeta>> => {
      if (resolvedUnit) {
        attachBridgeIfNeeded();
        return Promise.resolve(resolvedUnit);
      }

      resolvedUnitPromise ??= ensureStreamFactory().then((factory) => {
        const unit = factory(identity);
        resolvedUnit = unit;
        snapshot = unit.getSnapshot();
        attachBridgeIfNeeded();
        return unit;
      });

      return resolvedUnitPromise;
    };

    const start: StreamRun<TPayload, TData, TMeta> = (
      dataOrSetAction?: StreamRunInput<TPayload, TData, TMeta>,
      configOrMode?: object,
    ) => {
      return ensureUnit()
        .then((unit) => {
          const startStream = unit.getSnapshot().start;
          if (dataOrSetAction === undefined && configOrMode === undefined) {
            return Promise.resolve(
              Reflect.apply(
                startStream,
                unit,
                [],
              ),
            ).then(() => undefined);
          }

          if (configOrMode === undefined) {
            return Promise.resolve(
              Reflect.apply(
                startStream,
                unit,
                [dataOrSetAction],
              ),
            ).then(() => undefined);
          }

          return Promise.resolve(
            Reflect.apply(
              startStream,
              unit,
              [dataOrSetAction, configOrMode],
            ),
          ).then(() => undefined);
        })
        .then(() => {
          if (!resolvedUnit) {
            return;
          }

          snapshot = resolvedUnit.getSnapshot();
        });
    };
    const stop = (): void => {
      if (!resolvedUnit) {
        return;
      }

      resolvedUnit.getSnapshot().stop();
      snapshot = resolvedUnit.getSnapshot();
      notifyListeners();
    };

    const getSnapshot = (): StreamSnapshot<TPayload, TData, TMeta> => {
      if (!resolvedUnit) {
        if (streamSnapshotCache && Object.is(streamSnapshotBaseCache, snapshot)) {
          return streamSnapshotCache;
        }

        streamSnapshotBaseCache = snapshot;
        streamSnapshotCache = {
          ...snapshot,
          start,
          stop,
        };
        return streamSnapshotCache;
      }

      snapshot = resolvedUnit.getSnapshot();
      if (streamSnapshotCache && Object.is(streamSnapshotBaseCache, snapshot)) {
        return streamSnapshotCache;
      }

      streamSnapshotBaseCache = snapshot;
      streamSnapshotCache = {
        ...snapshot,
        start,
        stop,
      };
      return streamSnapshotCache;
    };

    const subscribe = (
      listener: EffectListener<TData, TMeta | null>,
    ): (() => void) => {
      listeners.add(listener);
      attachBridgeIfNeeded();

      return () => {
        listeners.delete(listener);
        detachBridgeIfNeeded();
      };
    };

    const unit: StreamUnit<TPayload, TData, TMeta> = {
      getSnapshot,
      subscribe,
    };

    unitByIdentityKey.set(identityKey, unit);
    return unit;
  };

  return streamFactoryLazy;
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
    return createLazyStreamFromConfig({
      entity,
      mode,
    }, config);
  };

  return streamByEntityMode;
};

export type {
  Stream,
  StreamBuilderInput,
  StreamByEntityModeBuilder,
  StreamCleanup,
  StreamConfig,
  StreamStart,
  StreamMetaOfConfig,
  StreamPayloadOfConfig,
  StreamRunContext,
  StreamRunResult,
  StreamSnapshot,
  StreamUnit,
} from './stream/index.js';
