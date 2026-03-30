import {
  DEFAULT_UNIT_DESTROY_DELAY,
  createSerializedKeyCache,
  createUnitSnapshot,
  isUnitSnapshotEqual,
  isUnitLoadingStatus,
  isUnitSettledStatus,
  notifyEffectListeners,
  type EffectListener,
  type UnitSnapshot,
} from './utils/index.js';

interface DependencyUnit<TValue> {
  getSnapshot: () => UnitSnapshot<TValue>;
  subscribe: (listener: (snapshot: UnitSnapshot<TValue>) => void) => (() => void) | void;
}

interface ViewGetContext<TIdentity extends object | undefined> {
  identity: TIdentity;
  get: <TValue>(unit: DependencyUnit<TValue>) => Promise<UnitSnapshot<TValue>>;
}

export interface ViewConfig<
  TIdentity extends object | undefined,
  RResult,
> {
  out: (context: ViewGetContext<TIdentity>) => Promise<RResult> | RResult;
  defaultValue?: RResult;
  destroyDelay?: number;
}

export interface ViewUnit<RResult> {
  getSnapshot: () => ViewSnapshot<RResult>;
  subscribe: (listener: EffectListener<RResult>) => (() => void) | void;
}

export interface View<
  TIdentity extends object | undefined = object | undefined,
  RResult = unknown,
> {
  (identity: TIdentity): ViewUnit<RResult>;
}

interface DependencyInternal {
  unit: DependencyUnit<unknown>;
  snapshot: UnitSnapshot<unknown>;
  removeEffect: (() => void) | null;
  dirtyWhileLoading: boolean;
}

interface ViewUnitInternal<
  TIdentity extends object | undefined,
  RResult,
> {
  key: string;
  identity: TIdentity;
  snapshot: UnitSnapshot<RResult>;
  listeners: Set<EffectListener<RResult>>;
  dependencies: Map<object, DependencyInternal>;
  recomputeScheduled: boolean;
  recomputeRunning: boolean;
  recomputePending: boolean;
  lastDependencyMeta: unknown;
  lastDependencyContext: unknown;
  stopped: boolean;
  destroyed: boolean;
  unit: ViewUnit<RResult>;
}

export type ViewSnapshot<RResult> = UnitSnapshot<RResult> & {
  refresh: () => Promise<ViewSnapshot<RResult>>;
};

const createErrorContext = (error: unknown): { message: string; cause: unknown } => {
  if (error instanceof Error) {
    return {
      message: error.message,
      cause: error,
    };
  }

  return {
    message: String(error),
    cause: error,
  };
};

interface NextSnapshotInput<RResult> {
  value?: RResult;
  status?: UnitSnapshot<RResult>['status'];
  meta?: unknown;
  context?: unknown;
}

const getSnapshotValue = <RResult>(
  current: UnitSnapshot<RResult>,
  next: NextSnapshotInput<RResult>,
): RResult => {
  return Object.prototype.hasOwnProperty.call(next, 'value')
    ? (next.value as RResult)
    : current.value;
};

const getSnapshotStatus = <RResult>(
  current: UnitSnapshot<RResult>,
  next: NextSnapshotInput<RResult>,
): UnitSnapshot<RResult>['status'] => {
  return Object.prototype.hasOwnProperty.call(next, 'status')
    ? (next.status as UnitSnapshot<RResult>['status'])
    : current.status;
};

const getSnapshotMeta = <RResult>(
  current: UnitSnapshot<RResult>,
  next: NextSnapshotInput<RResult>,
): unknown => {
  return Object.prototype.hasOwnProperty.call(next, 'meta')
    ? next.meta
    : current.meta;
};

const getSnapshotContext = <RResult>(
  current: UnitSnapshot<RResult>,
  next: NextSnapshotInput<RResult>,
): unknown => {
  return Object.prototype.hasOwnProperty.call(next, 'context')
    ? next.context
    : current.context;
};

const applySnapshot = <
  TIdentity extends object | undefined,
  RResult,
>(
  internal: ViewUnitInternal<TIdentity, RResult>,
  next: NextSnapshotInput<RResult>,
): boolean => {
  const currentSnapshot = internal.snapshot;
  const nextValue = getSnapshotValue(currentSnapshot, next);
  const nextStatus = getSnapshotStatus(currentSnapshot, next);
  const nextMeta = getSnapshotMeta(currentSnapshot, next);
  const nextContext = getSnapshotContext(currentSnapshot, next);

  if (isUnitSnapshotEqual({
    left: currentSnapshot,
    right: {
      value: nextValue,
      status: nextStatus,
      meta: nextMeta,
      context: nextContext,
    },
  })) {
    return false;
  }

  const nextSnapshot = createUnitSnapshot({
    identity: internal.identity,
    value: nextValue,
    status: nextStatus,
    meta: nextMeta,
    context: nextContext,
  });
  internal.snapshot = nextSnapshot;
  notifyEffectListeners(internal.listeners, internal.snapshot);
  return true;
};

const readCurrentDependencySnapshot = <TValue>(
  unit: DependencyUnit<TValue>,
): UnitSnapshot<TValue> => {
  return unit.getSnapshot();
};

const unsubscribeDependency = (dependency: DependencyInternal): void => {
  dependency.removeEffect?.();
  dependency.removeEffect = null;
};

const unsubscribeAllDependencies = <
  TIdentity extends object | undefined,
  RResult,
>(
  internal: ViewUnitInternal<TIdentity, RResult>,
): void => {
  Array.from(internal.dependencies.values()).forEach((dependency) => {
    unsubscribeDependency(dependency);
  });
};

const shouldTrackDependencies = <
  TIdentity extends object | undefined,
  RResult,
>(
  internal: ViewUnitInternal<TIdentity, RResult>,
): boolean => {
  return !internal.destroyed && !internal.stopped && internal.listeners.size > 0;
};

interface RecomputeInput<TIdentity extends object | undefined, RResult> {
  internal: ViewUnitInternal<TIdentity, RResult>;
  out: (context: ViewGetContext<TIdentity>) => Promise<RResult> | RResult;
  shouldThrow?: boolean;
}

const queueRecompute = <
  TIdentity extends object | undefined,
  RResult,
>(
  input: RecomputeInput<TIdentity, RResult>,
): void => {
  const { internal } = input;
  if (internal.destroyed || internal.stopped) {
    return;
  }

  if (internal.recomputeRunning) {
    internal.recomputePending = true;
    return;
  }

  if (internal.recomputeScheduled) {
    return;
  }

  internal.recomputeScheduled = true;
  Promise.resolve().then(() => {
    internal.recomputeScheduled = false;
    void runRecompute(input);
  });
};

interface EnsureDependencySubscriptionInput<
  TIdentity extends object | undefined,
  RResult,
> {
  internal: ViewUnitInternal<TIdentity, RResult>;
  dependencyKey: object;
  dependency: DependencyInternal;
  out: (context: ViewGetContext<TIdentity>) => Promise<RResult> | RResult;
}

const ensureDependencySubscription = <
  TIdentity extends object | undefined,
  RResult,
>(
  {
    internal,
    dependencyKey,
    dependency,
    out,
  }: EnsureDependencySubscriptionInput<TIdentity, RResult>,
): void => {
  if (dependency.removeEffect || !shouldTrackDependencies(internal)) {
    return;
  }

  const removeEffect = dependency.unit.subscribe((snapshot) => {
    const previousSnapshot = dependency.snapshot;
    dependency.snapshot = snapshot;
    internal.lastDependencyMeta = snapshot.meta;
    internal.lastDependencyContext = snapshot.context;

    if (!shouldTrackDependencies(internal)) {
      return;
    }

    const hasDataChange = !Object.is(snapshot.value, previousSnapshot.value);
    const hasMetaChange = !Object.is(snapshot.meta, previousSnapshot.meta);
    const hasMeaningfulChange = hasDataChange || hasMetaChange;
    const shouldProcessSettledFromDirty = dependency.dirtyWhileLoading
      && isUnitSettledStatus(snapshot.status);
    if (!hasMeaningfulChange && !shouldProcessSettledFromDirty) {
      return;
    }

    if (isUnitLoadingStatus(snapshot.status) && internal.snapshot.status === 'idle') {
      if (hasDataChange || hasMetaChange) {
        dependency.dirtyWhileLoading = true;
      }

      applySnapshot(internal, {
        status: snapshot.status,
        meta: snapshot.meta,
        context: snapshot.context,
      });
      return;
    }

    if (isUnitLoadingStatus(snapshot.status)) {
      if (hasDataChange || hasMetaChange) {
        dependency.dirtyWhileLoading = true;
      }
      return;
    }

    if (isUnitSettledStatus(snapshot.status)) {
      const shouldRecompute =
        hasDataChange
        || hasMetaChange
        || dependency.dirtyWhileLoading;
      dependency.dirtyWhileLoading = false;

      if (!shouldRecompute) {
        return;
      }

      queueRecompute({
        internal,
        out,
      });
    }
  });

  dependency.removeEffect = removeEffect ?? null;
  internal.dependencies.set(dependencyKey, dependency);

  const latestSnapshot = readCurrentDependencySnapshot(dependency.unit);
  const hasLatestDataChange = !Object.is(latestSnapshot.value, dependency.snapshot.value);
  const hasLatestMetaChange = !Object.is(latestSnapshot.meta, dependency.snapshot.meta);
  const hasLatestContextChange = !Object.is(latestSnapshot.context, dependency.snapshot.context);
  const hasLatestStatusChange = latestSnapshot.status !== dependency.snapshot.status;

  if (!hasLatestDataChange && !hasLatestMetaChange && !hasLatestStatusChange && !hasLatestContextChange) {
    return;
  }

  dependency.snapshot = latestSnapshot;
  internal.lastDependencyMeta = latestSnapshot.meta;
  internal.lastDependencyContext = latestSnapshot.context;

  if (isUnitLoadingStatus(latestSnapshot.status)) {
    if (hasLatestDataChange || hasLatestMetaChange) {
      dependency.dirtyWhileLoading = true;
    }

    if (internal.snapshot.status === 'idle') {
      applySnapshot(internal, {
        status: latestSnapshot.status,
        meta: latestSnapshot.meta,
        context: latestSnapshot.context,
      });
    }
    return;
  }

  if (isUnitSettledStatus(latestSnapshot.status)) {
    if (hasLatestDataChange || hasLatestMetaChange || dependency.dirtyWhileLoading) {
      dependency.dirtyWhileLoading = false;
      queueRecompute({
        internal,
        out,
      });
    }
  }
};

interface SyncDependenciesInput<
  TIdentity extends object | undefined,
  RResult,
> {
  internal: ViewUnitInternal<TIdentity, RResult>;
  usedDependencies: Map<object, DependencyInternal>;
  out: (context: ViewGetContext<TIdentity>) => Promise<RResult> | RResult;
}

const syncDependencies = <
  TIdentity extends object | undefined,
  RResult,
>(
  {
    internal,
    usedDependencies,
    out,
  }: SyncDependenciesInput<TIdentity, RResult>,
): void => {
  Array.from(internal.dependencies.entries()).forEach(([dependencyKey, dependency]) => {
    if (usedDependencies.has(dependencyKey)) {
      return;
    }

    unsubscribeDependency(dependency);
    internal.dependencies.delete(dependencyKey);
  });

  Array.from(usedDependencies.entries()).forEach(([dependencyKey, nextDependency]) => {
    const existing = internal.dependencies.get(dependencyKey);
    if (existing) {
      existing.snapshot = nextDependency.snapshot;
      ensureDependencySubscription({
        internal,
        dependencyKey,
        dependency: existing,
        out,
      });
      return;
    }

    ensureDependencySubscription({
      internal,
      dependencyKey,
      dependency: nextDependency,
      out,
    });
  });

  if (!shouldTrackDependencies(internal)) {
    unsubscribeAllDependencies(internal);
  }
};

const readDependencySnapshot = <
  TIdentity extends object | undefined,
  RResult,
  TValue,
>(
  internal: ViewUnitInternal<TIdentity, RResult>,
  unit: DependencyUnit<TValue>,
): UnitSnapshot<TValue> => {
  const dependencyKey = unit as unknown as object;
  const existing = internal.dependencies.get(dependencyKey);
  if (existing) {
    internal.lastDependencyMeta = existing.snapshot.meta;
    internal.lastDependencyContext = existing.snapshot.context;
    return existing.snapshot as UnitSnapshot<TValue>;
  }

  const snapshot = readCurrentDependencySnapshot(unit);
  internal.lastDependencyMeta = snapshot.meta;
  internal.lastDependencyContext = snapshot.context;
  return snapshot;
};

const runRecompute = async <
  TIdentity extends object | undefined,
  RResult,
>({
  internal,
  out,
  shouldThrow = false,
}: RecomputeInput<TIdentity, RResult>): Promise<RResult> => {
  if (internal.destroyed || internal.stopped) {
    return internal.snapshot.value;
  }

  if (internal.recomputeRunning) {
    internal.recomputePending = true;
    return internal.snapshot.value;
  }

  internal.recomputeRunning = true;
  const usedDependencies = new Map<object, DependencyInternal>();

  try {
    if (internal.snapshot.status === 'idle') {
      applySnapshot(internal, {
        status: 'loading',
      });
    }

    const nextValue = await out({
      identity: internal.identity,
      get: async <TValue>(unit: DependencyUnit<TValue>) => {
        const snapshot = readDependencySnapshot(internal, unit);
        usedDependencies.set(unit as unknown as object, {
          unit: unit as unknown as DependencyUnit<unknown>,
          snapshot: snapshot as UnitSnapshot<unknown>,
          removeEffect: null,
          dirtyWhileLoading: false,
        });
        return snapshot;
      },
    });

    syncDependencies({
      internal,
      usedDependencies,
      out,
    });

    const dependencies = Array.from(usedDependencies.values());
    const latestDependency = dependencies.at(-1);

    applySnapshot(internal, {
      value: nextValue,
      status: 'success',
      meta: latestDependency
        ? latestDependency.snapshot.meta
        : internal.lastDependencyMeta,
      context: latestDependency
        ? latestDependency.snapshot.context
        : internal.lastDependencyContext,
    });

    return nextValue;
  } catch (error: unknown) {
    syncDependencies({
      internal,
      usedDependencies,
      out,
    });

    applySnapshot(internal, {
      status: 'error',
      context: createErrorContext(error),
    });

    if (shouldThrow) {
      throw error;
    }

    return internal.snapshot.value;
  } finally {
    internal.recomputeRunning = false;

    if (internal.recomputePending) {
      internal.recomputePending = false;
      void runRecompute({
        internal,
        out,
      });
    }
  }
};

export const view = <
  TIdentity extends object | undefined,
  RResult = unknown,
>({
  out,
  defaultValue,
  destroyDelay: _destroyDelay = DEFAULT_UNIT_DESTROY_DELAY,
}: ViewConfig<TIdentity, RResult>): View<TIdentity, RResult> => {
  const unitsByKey = new Map<string, ViewUnitInternal<TIdentity, RResult>>();
  const unitKeyCache = createSerializedKeyCache({
    mode: 'identity-unit',
  });

  const viewFactory: View<TIdentity, RResult> = (identity) => {
    const key = unitKeyCache.getOrCreateKey(identity);
    const existing = unitsByKey.get(key);
    if (existing) {
      return existing.unit;
    }

    const initialSnapshot = createUnitSnapshot({
      identity,
      value: (defaultValue ?? null) as RResult,
      status: 'idle',
      meta: null,
      context: null,
    });

    const internal: ViewUnitInternal<TIdentity, RResult> = {
      key,
      identity,
      snapshot: initialSnapshot,
      listeners: new Set<EffectListener<RResult>>(),
      dependencies: new Map<object, DependencyInternal>(),
      recomputeScheduled: false,
      recomputeRunning: false,
      recomputePending: false,
      lastDependencyMeta: null,
      lastDependencyContext: null,
      stopped: false,
      destroyed: false,
      unit: {} as ViewUnit<RResult>,
    };

    const refresh = async (): Promise<ViewSnapshot<RResult>> => {
      await runRecompute({
        internal,
        out,
        shouldThrow: true,
      });
      return unit.getSnapshot();
    };

    const resolveViewSnapshot = (): ViewSnapshot<RResult> => {
      return {
        ...internal.snapshot,
        refresh,
      };
    };

    const unit: ViewUnit<RResult> = {
      getSnapshot: () => {
        return resolveViewSnapshot();
      },
      subscribe: (listener) => {
        if (internal.destroyed) {
          return undefined;
        }

        internal.stopped = false;
        internal.listeners.add(listener);

        if (internal.listeners.size === 1) {
          void runRecompute({
            internal,
            out,
          });
        }

        return () => {
          internal.listeners.delete(listener);

          if (internal.listeners.size === 0) {
            unsubscribeAllDependencies(internal);
          }
        };
      },
    };

    internal.unit = unit;
    unitsByKey.set(key, internal);

    return unit;
  };

  return viewFactory;
};
