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
  Action,
  ActionBuilder,
  ActionBuilderInput,
  ActionByEntityModeBuilder,
  ActionConfig,
  ActionSnapshot,
  ActionRun,
  ActionRunInput,
  ActionUnit,
} from './action/index.js';
import {
  shouldWarmupOnFirstRun,
} from './configureLazy.js';
import {
  loadLazyActionModule,
} from './preload.js';

const createLazyActionFromConfig = <
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
  config: ActionConfig<TIdentity, TPayload, EntityValueOfStore<TEntityStore>, TMode, TMeta>,
): Action<TIdentity, TPayload, UnitDataByEntityMode<EntityValueOfStore<TEntityStore>, TMode>, TMeta> => {
  type TEntity = EntityValueOfStore<TEntityStore>;
  type TData = UnitDataByEntityMode<TEntity, TMode>;

  const identityKeyCache = createSerializedKeyCache({
    mode: 'identity-unit',
  });
  const unitByIdentityKey = new Map<string, ActionUnit<TPayload, TData, TMeta>>();
  let actionFactory: Action<TIdentity, TPayload, TData, TMeta> | undefined;
  let actionFactoryPromise: Promise<Action<TIdentity, TPayload, TData, TMeta>> | undefined;

  const ensureActionFactory = (): Promise<Action<TIdentity, TPayload, TData, TMeta>> => {
    if (actionFactory) {
      return Promise.resolve(actionFactory);
    }

    if (!actionFactoryPromise) {
      actionFactoryPromise = loadLazyActionModule().then((module) => {
        const actionByEntityMode = module.action<TEntityStore, TMode>({
          entity,
          mode,
        });
        const createdFactory = actionByEntityMode<TIdentity, TPayload, TMeta>(config);
        actionFactory = createdFactory;
        return createdFactory;
      });
    }

    return actionFactoryPromise;
  };

  if (shouldWarmupOnFirstRun()) {
    void ensureActionFactory();
  }

  const actionFactoryLazy: Action<TIdentity, TPayload, TData, TMeta> = (identity) => {
    const identityKey = identityKeyCache.getOrCreateKey(identity);
    const existingUnit = unitByIdentityKey.get(identityKey);
    if (existingUnit) {
      return existingUnit;
    }

    let resolvedUnit: ActionUnit<TPayload, TData, TMeta> | undefined;
    let resolvedUnitPromise: Promise<ActionUnit<TPayload, TData, TMeta>> | undefined;
    let bridgeAttached = false;
    let bridgeCleanup: (() => void) | undefined;
    const listeners = new Set<EffectListener<TData, TMeta | null>>();
    const initialValue = resolveDefaultUnitValue({
      defaultValue: config.defaultValue,
      mode,
    });
    let snapshot: UnitSnapshot<TData, TMeta | null> = {
      identity,
      value: initialValue,
      status: 'idle',
      meta: null,
      context: null,
    };
    let actionSnapshotCache: ActionSnapshot<TPayload, TData, TMeta> | null = null;
    let actionSnapshotBaseCache = snapshot;

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

    const ensureUnit = (): Promise<ActionUnit<TPayload, TData, TMeta>> => {
      if (resolvedUnit) {
        attachBridgeIfNeeded();
        return Promise.resolve(resolvedUnit);
      }

      resolvedUnitPromise ??= ensureActionFactory().then((factory) => {
        const unit = factory(identity);
        resolvedUnit = unit;
        snapshot = unit.getSnapshot();
        attachBridgeIfNeeded();
        return unit;
      });

      return resolvedUnitPromise;
    };

    const execute: ActionRun<TPayload, TData, TMeta> = (
      dataOrSetAction?: ActionRunInput<TPayload, TData, TMeta>,
      configOrMode?: object,
    ) => {
      return ensureUnit()
        .then((unit) => {
          const submit = unit.getSnapshot().submit;
          if (dataOrSetAction === undefined && configOrMode === undefined) {
            return Promise.resolve(
              Reflect.apply(
                submit,
                unit,
                [],
              ),
            ).then(() => undefined);
          }

          if (configOrMode === undefined) {
            return Promise.resolve(
              Reflect.apply(
                submit,
                unit,
                [dataOrSetAction],
              ),
            ).then(() => undefined);
          }

          return Promise.resolve(
            Reflect.apply(
              submit,
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

    const getSnapshot = (): ActionSnapshot<TPayload, TData, TMeta> => {
      if (!resolvedUnit) {
        if (actionSnapshotCache && Object.is(actionSnapshotBaseCache, snapshot)) {
          return actionSnapshotCache;
        }

        actionSnapshotBaseCache = snapshot;
        actionSnapshotCache = {
          ...snapshot,
          submit: execute,
        };
        return actionSnapshotCache;
      }

      snapshot = resolvedUnit.getSnapshot();
      if (actionSnapshotCache && Object.is(actionSnapshotBaseCache, snapshot)) {
        return actionSnapshotCache;
      }

      actionSnapshotBaseCache = snapshot;
      actionSnapshotCache = {
        ...snapshot,
        submit: execute,
      };
      return actionSnapshotCache;
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

    const unit: ActionUnit<TPayload, TData, TMeta> = {
      getSnapshot,
      subscribe,
    };

    unitByIdentityKey.set(identityKey, unit);
    return unit;
  };

  return actionFactoryLazy;
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
    return createLazyActionFromConfig({
      entity,
      mode,
    }, config);
  };

  return actionByEntityMode;
};

export type {
  Action,
  ActionBuilderInput,
  ActionByEntityModeBuilder,
  ActionCleanup,
  ActionConfig,
  ActionExecute,
  ActionMetaOfConfig,
  ActionPayloadOfConfig,
  ActionRunContext,
  ActionRunResult,
  ActionSnapshot,
  ActionUnit,
} from './action/index.js';
