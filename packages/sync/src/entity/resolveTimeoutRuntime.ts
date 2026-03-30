import type { TimeoutRuntime } from './types.js';

const hasTimeoutRuntime = (value: unknown): value is TimeoutRuntime => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return 'setTimeout' in value
    && 'clearTimeout' in value
    && typeof value.setTimeout === 'function'
    && typeof value.clearTimeout === 'function';
};

export const resolveTimeoutRuntime = (): TimeoutRuntime | undefined => {
  const runtime = globalThis;
  if (!hasTimeoutRuntime(runtime)) {
    return undefined;
  }

  return runtime;
};
