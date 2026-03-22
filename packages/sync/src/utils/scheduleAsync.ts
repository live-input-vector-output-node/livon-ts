interface TimeoutRuntime {
  setTimeout: (callback: () => void, delay: number) => unknown;
}

interface MicrotaskRuntime {
  queueMicrotask: (callback: () => void) => void;
}

export interface SchedulerRuntime {
  setTimeout?: unknown;
  queueMicrotask?: unknown;
}

export interface ScheduleAsyncInput {
  callback: () => void;
  runtime?: SchedulerRuntime;
}

const hasTimeoutRuntime = (
  input: SchedulerRuntime,
): input is TimeoutRuntime => {
  return typeof input.setTimeout === 'function';
};

const hasMicrotaskRuntime = (
  input: SchedulerRuntime,
): input is MicrotaskRuntime => {
  return typeof input.queueMicrotask === 'function';
};

const readRuntime = (): SchedulerRuntime => {
  return globalThis as SchedulerRuntime;
};

export const scheduleAsync = ({
  callback,
  runtime = readRuntime(),
}: ScheduleAsyncInput): void => {
  if (hasMicrotaskRuntime(runtime)) {
    runtime.queueMicrotask(callback);
    return;
  }

  if (hasTimeoutRuntime(runtime)) {
    runtime.setTimeout(callback, 0);
    return;
  }

  throw new Error('No async scheduler is available on runtime.');
};
