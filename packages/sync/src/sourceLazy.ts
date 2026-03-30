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
  Source,
  SourceBuilderInput,
  SourceByEntityModeBuilder,
  SourceBuilder,
  SourceConfig,
  SourceContext,
  SourceSnapshot,
  SourceRun,
  SourceFetchInput,
  SourceRunInput,
  SourceUnit,
} from './source/index.js';
import {
  shouldWarmupOnFirstRun,
} from './configureLazy.js';
import {
  loadLazySourceModule,
} from './preload.js';

const LAZY_SOURCE_INITIAL_CONTEXT: SourceContext = {
  cacheState: 'disabled',
  error: null,
};

const createLazySourceFromConfig = <
  TIdentity extends object | undefined,
  TPayload,
  TMeta,
  TEntityStore extends Entity<object, EntityId>,
  TMode extends UnitEntityMode,
>(
  {
    entity,
    mode,
  }: SourceBuilderInput<TEntityStore, TMode>,
  config: SourceConfig<TIdentity, TPayload, EntityValueOfStore<TEntityStore>, TMode, TMeta>,
): Source<TIdentity, TPayload, UnitDataByEntityMode<EntityValueOfStore<TEntityStore>, TMode>, TMeta> => {
  type TEntity = EntityValueOfStore<TEntityStore>;
  type TData = UnitDataByEntityMode<TEntity, TMode>;

  const identityKeyCache = createSerializedKeyCache({
    mode: 'identity-unit',
  });
  const unitByIdentityKey = new Map<string, SourceUnit<TIdentity, TPayload, TData, TMeta>>();
  let sourceFactory: Source<TIdentity, TPayload, TData, TMeta> | undefined;
  let sourceFactoryPromise: Promise<Source<TIdentity, TPayload, TData, TMeta>> | undefined;

  const ensureSourceFactory = (): Promise<Source<TIdentity, TPayload, TData, TMeta>> => {
    if (sourceFactory) {
      return Promise.resolve(sourceFactory);
    }

    if (!sourceFactoryPromise) {
      sourceFactoryPromise = loadLazySourceModule().then((module) => {
        const sourceByEntityMode = module.source<TEntityStore, TMode>({
          entity,
          mode,
        });
        const createdFactory = sourceByEntityMode<TIdentity, TPayload, TMeta>(config);
        sourceFactory = createdFactory;
        return createdFactory;
      });
    }

    if (!sourceFactoryPromise) {
      throw new Error('Failed to initialize source factory.');
    }
    return sourceFactoryPromise;
  };

  if (shouldWarmupOnFirstRun()) {
    void ensureSourceFactory();
  }

  const sourceFactoryLazy: Source<TIdentity, TPayload, TData, TMeta> = (identity) => {
    const identityKey = identityKeyCache.getOrCreateKey(identity);
    const existingUnit = unitByIdentityKey.get(identityKey);
    if (existingUnit) {
      return existingUnit;
    }

    let resolvedUnit: SourceUnit<TIdentity, TPayload, TData, TMeta> | undefined;
    let resolvedUnitPromise: Promise<SourceUnit<TIdentity, TPayload, TData, TMeta>> | undefined;
    let bridgeAttached = false;
    let bridgeCleanup: (() => void) | undefined;
    const listeners = new Set<EffectListener<TData, TMeta | null, SourceContext, TIdentity>>();
    const initialValue = resolveDefaultUnitValue({
      defaultValue: config.defaultValue,
      mode,
    }) as TData;
    let snapshot: UnitSnapshot<TData, TMeta | null, SourceContext, TIdentity> = {
      identity,
      value: initialValue,
      status: 'idle',
      meta: null,
      context: LAZY_SOURCE_INITIAL_CONTEXT,
    };
    let sourceSnapshotCache: SourceSnapshot<TIdentity, TPayload, TData, TMeta> | null = null;
    let sourceSnapshotBaseCache = snapshot;

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

    const ensureUnit = (): Promise<SourceUnit<TIdentity, TPayload, TData, TMeta>> => {
      if (resolvedUnit) {
        attachBridgeIfNeeded();
        return Promise.resolve(resolvedUnit);
      }

      resolvedUnitPromise ??= ensureSourceFactory().then((factory) => {
        const unit = factory(identity);
        resolvedUnit = unit;
        snapshot = unit.getSnapshot();
        attachBridgeIfNeeded();
        return unit;
      });

      return resolvedUnitPromise;
    };

    const fetch: SourceRun<TPayload, TData, TMeta> = (
      dataOrSetAction?: SourceRunInput<TPayload, TData, TMeta>,
      configOrMode?: { mode?: 'default' | 'refetch' | 'force' },
    ) => {
      return ensureUnit()
        .then((unit) => {
          const load = unit.getSnapshot().load;
          if (dataOrSetAction === undefined && configOrMode === undefined) {
            return Promise.resolve(
              Reflect.apply(
                load,
                unit,
                [],
              ),
            ).then(() => undefined);
          }

          if (configOrMode === undefined) {
            return Promise.resolve(
              Reflect.apply(
                load,
                unit,
                [dataOrSetAction],
              ),
            ).then(() => undefined);
          }

          return Promise.resolve(
            Reflect.apply(
              load,
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
    const refetch = (
      input?: SourceFetchInput<TPayload, TData, TMeta>,
    ): Promise<void> => {
      if (input === undefined) {
        return Promise.resolve(
          Reflect.apply(fetch, undefined, [
            undefined,
            { mode: 'refetch' },
          ]),
        );
      }

      return Promise.resolve(
        Reflect.apply(fetch, undefined, [
          input,
          { mode: 'refetch' },
        ]),
      );
    };
    const force = (
      input?: SourceFetchInput<TPayload, TData, TMeta>,
    ): Promise<void> => {
      if (input === undefined) {
        return Promise.resolve(
          Reflect.apply(fetch, undefined, [
            undefined,
            { mode: 'force' },
          ]),
        );
      }

      return Promise.resolve(
        Reflect.apply(fetch, undefined, [
          input,
          { mode: 'force' },
        ]),
      );
    };

    const getSnapshot = (): SourceSnapshot<TIdentity, TPayload, TData, TMeta> => {
      if (!resolvedUnit) {
        if (sourceSnapshotCache && Object.is(sourceSnapshotBaseCache, snapshot)) {
          return sourceSnapshotCache;
        }

        sourceSnapshotBaseCache = snapshot;
        sourceSnapshotCache = {
          ...snapshot,
          load: fetch,
          refetch,
          force,
        };
        return sourceSnapshotCache;
      }

      snapshot = resolvedUnit.getSnapshot();
      if (sourceSnapshotCache && Object.is(sourceSnapshotBaseCache, snapshot)) {
        return sourceSnapshotCache;
      }

      sourceSnapshotBaseCache = snapshot;
      sourceSnapshotCache = {
        ...snapshot,
        load: fetch,
        refetch,
        force,
      };
      return sourceSnapshotCache;
    };

    const subscribe = (
      listener: EffectListener<TData, TMeta | null, SourceContext, TIdentity>,
    ): (() => void) => {
      listeners.add(listener);
      attachBridgeIfNeeded();

      return () => {
        listeners.delete(listener);
        detachBridgeIfNeeded();
      };
    };

    const unit: SourceUnit<TIdentity, TPayload, TData, TMeta> = {
      getSnapshot,
      subscribe,
    };

    unitByIdentityKey.set(identityKey, unit);
    return unit;
  };

  return sourceFactoryLazy;
};

export const source: SourceBuilder = <
  TEntityStore extends Entity<object, EntityId>,
  TMode extends UnitEntityMode,
>({
  entity,
  mode,
}: SourceBuilderInput<TEntityStore, TMode>): SourceByEntityModeBuilder<TEntityStore, TMode> => {
  const sourceByEntityMode: SourceByEntityModeBuilder<TEntityStore, TMode> = <
    TIdentity extends object | undefined,
    TPayload,
    TMeta,
  >(
    config: SourceConfig<
      TIdentity,
      TPayload,
      EntityValueOfStore<TEntityStore>,
      TMode,
      TMeta
    >,
  ) => {
    return createLazySourceFromConfig({
      entity,
      mode,
    }, config);
  };

  return sourceByEntityMode;
};

export type {
  Source,
  SourceBuilderInput,
  SourceByEntityModeBuilder,
  SourceCleanup,
  SourceConfig,
  SourceDestroyContext,
  SourceFetch,
  SourceFetchConfig,
  SourceFetchInput,
  SourceMetaOfConfig,
  SourcePayloadOfConfig,
  SourceRunContext,
  SourceRunResult,
  SourceSnapshot,
  SourceContext,
  SourceUnit,
  SourceUnitByKeyMap,
} from './source/index.js';
