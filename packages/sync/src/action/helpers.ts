import {
  type ActionCleanup,
  type ActionRunResult,
} from './types.js';

export const invokeActionCleanup = (
  cleanup: ActionCleanup | null,
): void => {
  if (!cleanup) {
    return;
  }

  try {
    cleanup();
  } catch {
    return;
  }
};

export const isActionCleanup = (
  input: ActionRunResult,
): input is ActionCleanup => {
  return typeof input === 'function';
};
