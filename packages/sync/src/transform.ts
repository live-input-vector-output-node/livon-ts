import {
  createSerializedKeyCache,
  createUnitSnapshot,
  isUnitLoadingStatus,
  isUnitSettledStatus,
  isUnitStatus,
  notifyEffectListeners,
  type EffectListener,
  type UnitSnapshot,
} from './utils/index.js';

interface DependencyUnit<TValue> {
  get: () => TValue | UnitSnapshot<TValue>;
  effect: (listener: (snapshot: UnitSnapshot<TValue>) => void) => (() => void) | void;
}

interface SettableUnit<TPayload> {
  run?: (payload: TPayload) => Promise<unknown> | unknown;
  set?: (payload: TPayload) => Promise<unknown> | unknown;
}

interface TransformGetContext<TInput extends object | undefined> {
  scope: TInput;
  get: <TValue>(unit: DependencyUnit<TValue>) => Promise<UnitSnapshot<TValue>>;
}

interface TransformSetContext<
  TInput extends object | undefined,
  TPayload,
> extends TransformGetContext<TInput> {
  payload: TPayload;
  set: <TSetPayload>(unit: SettableUnit<TSetPayload>, payload: TSetPayload) => Promise<unknown>;
}

export interface TransformConfig<
  TInput extends object | undefined,
  TPayload,
  RResult,
> {
  out: (context: TransformGetContext<TInput>) => Promise<RResult> | RResult;
  in?: (context: TransformSetContext<TInput, TPayload>) => Promise<void> | void;
  defaultValue?: RResult;
  destroyDelay?: number;
}

export interface TransformUnit<
  TPayload,
  RResult,
> {
  destroyDelay: number;
  get: () => UnitSnapshot<RResult>;
  set: (payload: TPayload) => Promise<void>;
  effect: (listener: EffectListener<RResult>) => (() => void) | void;
  stop: () => void;
  destroy: () => void;
}

export interface Transform<
  TInput extends object | undefined = object | undefined,
  TPayload = unknown,
  RResult = unknown,
> {
  (scope: TInput): TransformUnit<TPayload, RResult>;
}

interface DependencyInternal {
  unit: DependencyUnit<unknown>;
  snapshot: UnitSnapshot<unknown>;
  removeEffect: (() => void) | null;
  dirtyWhileLoading: boolean;
}

interface TransformUnitInternal<
  TInput extends object | undefined,
  TPayload,
  RResult,
> {
  key: string;
  scope: TInput;
  payload: TPayload;
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
  unit: TransformUnit<TPayload, RResult>;
}

const DEFAULT_DESTROY_DELAY = 250;

const isSnapshotLike = <TValue>(input: unknown): input is UnitSnapshot<TValue> => {
  if (typeof input !== 'object' || input === null) {
    return false;
  }

  const candidate = input as Record<string, unknown>;
  if (
    typeof candidate.status !== 'string'
    || !('value' in candidate)
    || !('meta' in candidate)
    || !('context' in candidate)
  ) {
    return false;
  }

  return isUnitStatus(candidate.status);
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
  TInput extends object | undefined,
  TPayload,
  RResult,
>(
  internal: TransformUnitInternal<TInput, TPayload, RResult>,
  next: NextSnapshotInput<RResult>,
): boolean => {
  const currentSnapshot = internal.snapshot;
  const nextValue = getSnapshotValue(currentSnapshot, next);
  const nextStatus = getSnapshotStatus(currentSnapshot, next);
  const nextMeta = getSnapshotMeta(currentSnapshot, next);
  const nextContext = getSnapshotContext(currentSnapshot, next);

  if (
    Object.is(nextValue, currentSnapshot.value)
    && nextStatus === currentSnapshot.status
    && Object.is(nextMeta, currentSnapshot.meta)
    && Object.is(nextContext, currentSnapshot.context)
  ) {
    return false;
  }

  const nextSnapshot = createUnitSnapshot({
    value: nextValue,
    status: nextStatus,
    meta: nextMeta,
    context: nextContext,
  });
  internal.snapshot = nextSnapshot;
  notifyEffectListeners(internal.listeners, internal.snapshot);
  return true;
};

const createSnapshotFromValue = <TValue>(
  value: TValue | UnitSnapshot<TValue>,
): UnitSnapshot<TValue> => {
  if (isSnapshotLike(value)) {
    return value as UnitSnapshot<TValue>;
  }

  return createUnitSnapshot({
    value: value as TValue,
    status: 'idle',
    meta: null,
    context: null,
  });
};

const readCurrentDependencySnapshot = <TValue>(
  unit: DependencyUnit<TValue>,
): UnitSnapshot<TValue> => {
  if ('getSnapshot' in unit) {
    const snapshotGetter = unit.getSnapshot;
    if (typeof snapshotGetter === 'function') {
      const snapshot = snapshotGetter();
      if (isSnapshotLike<TValue>(snapshot)) {
        return snapshot;
      }
    }
  }

  return createSnapshotFromValue(unit.get());
};

const unsubscribeDependency = (dependency: DependencyInternal): void => {
  dependency.removeEffect?.();
  dependency.removeEffect = null;
};

const unsubscribeAllDependencies = <
  TInput extends object | undefined,
  TPayload,
  RResult,
>(
  internal: TransformUnitInternal<TInput, TPayload, RResult>,
): void => {
  Array.from(internal.dependencies.values()).forEach((dependency) => {
    unsubscribeDependency(dependency);
  });
};

const shouldTrackDependencies = <
  TInput extends object | undefined,
  TPayload,
  RResult,
>(
  internal: TransformUnitInternal<TInput, TPayload, RResult>,
): boolean => {
  return !internal.destroyed && !internal.stopped && internal.listeners.size > 0;
};

const executeSetOnUnit = async <TPayload>(
  unit: SettableUnit<TPayload>,
  payload: TPayload,
): Promise<unknown> => {
  if (typeof unit.run === 'function') {
    return unit.run(payload);
  }

  if (typeof unit.set === 'function') {
    return unit.set(payload);
  }

  throw new Error('Transform context.set target has no run or set method.');
};

interface RecomputeInput<TInput extends object | undefined, TPayload, RResult> {
  internal: TransformUnitInternal<TInput, TPayload, RResult>;
  out: (context: TransformGetContext<TInput>) => Promise<RResult> | RResult;
  shouldThrow?: boolean;
}

const queueRecompute = <
  TInput extends object | undefined,
  TPayload,
  RResult,
>(
  input: RecomputeInput<TInput, TPayload, RResult>,
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
  TInput extends object | undefined,
  TPayload,
  RResult,
> {
  internal: TransformUnitInternal<TInput, TPayload, RResult>;
  dependencyKey: object;
  dependency: DependencyInternal;
  out: (context: TransformGetContext<TInput>) => Promise<RResult> | RResult;
}

const ensureDependencySubscription = <
  TInput extends object | undefined,
  TPayload,
  RResult,
>(
  {
    internal,
    dependencyKey,
    dependency,
    out,
  }: EnsureDependencySubscriptionInput<TInput, TPayload, RResult>,
): void => {
  if (dependency.removeEffect || !shouldTrackDependencies(internal)) {
    return;
  }

  const removeEffect = dependency.unit.effect((snapshot) => {
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
  TInput extends object | undefined,
  TPayload,
  RResult,
> {
  internal: TransformUnitInternal<TInput, TPayload, RResult>;
  usedDependencies: Map<object, DependencyInternal>;
  out: (context: TransformGetContext<TInput>) => Promise<RResult> | RResult;
}

const syncDependencies = <
  TInput extends object | undefined,
  TPayload,
  RResult,
>(
  {
    internal,
    usedDependencies,
    out,
  }: SyncDependenciesInput<TInput, TPayload, RResult>,
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
  TInput extends object | undefined,
  TPayload,
  RResult,
  TValue,
>(
  internal: TransformUnitInternal<TInput, TPayload, RResult>,
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
  TInput extends object | undefined,
  TPayload,
  RResult,
>({
  internal,
  out,
  shouldThrow = false,
}: RecomputeInput<TInput, TPayload, RResult>): Promise<RResult> => {
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
      scope: internal.scope,
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

interface RunSetInput<
  TInput extends object | undefined,
  TPayload,
  RResult,
> {
  internal: TransformUnitInternal<TInput, TPayload, RResult>;
  out: (context: TransformGetContext<TInput>) => Promise<RResult> | RResult;
  setIn: ((context: TransformSetContext<TInput, TPayload>) => Promise<void> | void) | undefined;
  payload: TPayload;
}

const runSet = async <
  TInput extends object | undefined,
  TPayload,
  RResult,
>({
  internal,
  out,
  setIn,
  payload,
}: RunSetInput<TInput, TPayload, RResult>): Promise<void> => {
  if (internal.destroyed) {
    return;
  }

  internal.stopped = false;
  internal.payload = payload;

  applySnapshot(internal, {
    status: 'loading',
  });

  try {
    if (setIn) {
      await setIn({
        scope: internal.scope,
        payload: internal.payload,
        get: async <TValue>(unit: DependencyUnit<TValue>) => {
          return readDependencySnapshot(internal, unit);
        },
        set: async <TSetPayload>(unit: SettableUnit<TSetPayload>, payload: TSetPayload) => {
          return executeSetOnUnit(unit, payload);
        },
      });
    }

    await runRecompute({
      internal,
      out,
      shouldThrow: true,
    });
  } catch (error: unknown) {
    applySnapshot(internal, {
      status: 'error',
      context: createErrorContext(error),
    });
    throw error;
  }
};

export const transform = <
  TInput extends object | undefined,
  TPayload = unknown,
  RResult = unknown,
>({
  out,
  in: setIn,
  defaultValue,
  destroyDelay = DEFAULT_DESTROY_DELAY,
}: TransformConfig<TInput, TPayload, RResult>): Transform<TInput, TPayload, RResult> => {
  const unitsByKey = new Map<string, TransformUnitInternal<TInput, TPayload, RResult>>();
  const unitKeyCache = createSerializedKeyCache({
    mode: 'scoped-unit',
  });

  const transformFactory: Transform<TInput, TPayload, RResult> = (scope) => {
    const key = unitKeyCache.getOrCreateKey(scope);
    const existing = unitsByKey.get(key);
    if (existing) {
      return existing.unit;
    }

    const initialSnapshot = createUnitSnapshot({
      value: (defaultValue ?? null) as RResult,
      status: 'idle',
      meta: null,
      context: null,
    });

    const internal: TransformUnitInternal<TInput, TPayload, RResult> = {
      key,
      scope,
      payload: undefined as TPayload,
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
      unit: {} as TransformUnit<TPayload, RResult>,
    };

    const unit: TransformUnit<TPayload, RResult> = {
      destroyDelay,
      get: () => {
        return internal.snapshot;
      },
      set: async (payloadInput) => {
        await runSet({
          internal,
          out,
          setIn,
          payload: payloadInput,
        });
      },
      effect: (listener) => {
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
      stop: () => {
        if (internal.destroyed) {
          return;
        }

        internal.stopped = true;
        unsubscribeAllDependencies(internal);
      },
      destroy: () => {
        if (internal.destroyed) {
          return;
        }

        internal.destroyed = true;
        internal.stopped = true;
        unsubscribeAllDependencies(internal);
        internal.listeners.clear();
        unitsByKey.delete(internal.key);
      },
    };

    internal.unit = unit;
    unitsByKey.set(key, internal);

    return unit;
  };

  return transformFactory;
};
