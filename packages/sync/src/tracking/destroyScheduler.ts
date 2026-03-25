import type { TrackedUnit } from './types.js';

const DEFAULT_DESTROY_DELAY = 250;

type DestroyTimeout = unknown;

interface TimerApi {
  setTimeout: (callback: () => void, delay: number) => DestroyTimeout;
  clearTimeout: (timeout: DestroyTimeout) => void;
}

interface MaybeTimerApi {
  setTimeout?: unknown;
  clearTimeout?: unknown;
}

interface ScheduleTrackedUnitDestroyInput {
  unit: object;
  destroyDelay?: number;
  onDestroy: () => void;
}

interface DestroyPlan {
  destroyAt: number;
  onDestroy: () => void;
}

const destroyPlanByUnit = new Map<object, DestroyPlan>();
let destroySweepTimeout: DestroyTimeout | null = null;
let destroyNextSweepAt: number | null = null;

const hasTimerApi = (
  input: object,
): input is TimerApi => {
  const timerApi = input as MaybeTimerApi;

  return typeof timerApi.setTimeout === 'function' && typeof timerApi.clearTimeout === 'function';
};

const readTimerApi = (): TimerApi => {
  const root = globalThis as object;

  if (hasTimerApi(root)) {
    return root;
  }

  throw new Error('Timer API is not available on globalThis.');
};

const normalizeDestroyDelay = (
  input: number | undefined = DEFAULT_DESTROY_DELAY,
): number => {
  if (typeof input !== 'number' || Number.isNaN(input)) {
    return DEFAULT_DESTROY_DELAY;
  }

  return input < 0 ? 0 : input;
};

const clearDestroySweepTimeout = (): void => {
  if (destroySweepTimeout === null) {
    destroyNextSweepAt = null;
    return;
  }

  const timerApi = readTimerApi();
  timerApi.clearTimeout(destroySweepTimeout);
  destroySweepTimeout = null;
  destroyNextSweepAt = null;
};

const resolveNextDestroySweepAt = (): number | null => {
  let nextSweepAt: number | null = null;
  destroyPlanByUnit.forEach((plan) => {
    if (nextSweepAt === null || plan.destroyAt < nextSweepAt) {
      nextSweepAt = plan.destroyAt;
    }
  });

  return nextSweepAt;
};

const runDueDestroyPlans = (): void => {
  if (destroyPlanByUnit.size === 0) {
    clearDestroySweepTimeout();
    return;
  }

  const now = Date.now();
  const dueUnits: object[] = [];
  destroyPlanByUnit.forEach((plan, unit) => {
    if (plan.destroyAt <= now) {
      dueUnits.push(unit);
    }
  });

  dueUnits.forEach((unit) => {
    const plan = destroyPlanByUnit.get(unit);
    if (!plan) {
      return;
    }

    destroyPlanByUnit.delete(unit);
    plan.onDestroy();
  });

  syncDestroySweepTimeout();
};

const syncDestroySweepTimeout = (): void => {
  const nextSweepAt = resolveNextDestroySweepAt();
  if (nextSweepAt === null) {
    clearDestroySweepTimeout();
    return;
  }

  if (destroySweepTimeout !== null && destroyNextSweepAt === nextSweepAt) {
    return;
  }

  clearDestroySweepTimeout();
  const timerApi = readTimerApi();
  destroyNextSweepAt = nextSweepAt;
  const delay = Math.max(0, nextSweepAt - Date.now());
  destroySweepTimeout = timerApi.setTimeout(() => {
    destroySweepTimeout = null;
    destroyNextSweepAt = null;
    runDueDestroyPlans();
  }, delay);
};

export const clearPendingTrackedUnitDestroy = (
  unit: object,
): void => {
  const plan = destroyPlanByUnit.get(unit);
  if (!plan) {
    return;
  }

  destroyPlanByUnit.delete(unit);
  if (plan.destroyAt === destroyNextSweepAt) {
    syncDestroySweepTimeout();
  }
};

export const scheduleTrackedUnitDestroy = ({
  unit,
  destroyDelay = DEFAULT_DESTROY_DELAY,
  onDestroy,
}: ScheduleTrackedUnitDestroyInput): void => {
  const delay = normalizeDestroyDelay(destroyDelay);

  clearPendingTrackedUnitDestroy(unit);

  if (delay === 0) {
    onDestroy();
    return;
  }

  const destroyAt = Date.now() + delay;
  destroyPlanByUnit.set(unit, {
    destroyAt,
    onDestroy,
  });

  if (destroyNextSweepAt === null || destroyAt < destroyNextSweepAt || destroySweepTimeout === null) {
    syncDestroySweepTimeout();
  }
};

export const readTrackedUnitDestroyDelay = <RResult>(
  unit: TrackedUnit<RResult>,
): number => {
  return normalizeDestroyDelay(unit.destroyDelay);
};
