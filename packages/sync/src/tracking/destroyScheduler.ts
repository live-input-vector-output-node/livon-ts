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

const timeoutByUnit = new WeakMap<object, DestroyTimeout>();

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

const timerApi = readTimerApi();

const normalizeDestroyDelay = (
  input: number | undefined = DEFAULT_DESTROY_DELAY,
): number => {
  if (typeof input !== 'number' || Number.isNaN(input)) {
    return DEFAULT_DESTROY_DELAY;
  }

  return input < 0 ? 0 : input;
};

export const clearPendingTrackedUnitDestroy = (
  unit: object,
): void => {
  const timeout = timeoutByUnit.get(unit);

  if (!timeout) {
    return;
  }

  timerApi.clearTimeout(timeout);
  timeoutByUnit.delete(unit);
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

  const timeout = timerApi.setTimeout(() => {
    timeoutByUnit.delete(unit);
    onDestroy();
  }, delay);

  timeoutByUnit.set(unit, timeout);
};

export const readTrackedUnitDestroyDelay = <RResult>(
  unit: TrackedUnit<RResult>,
): number => {
  return normalizeDestroyDelay(unit.destroyDelay);
};
