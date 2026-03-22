import type { ValueUpdater } from './types.js';

const isValueUpdater = <RResult, UUpdate>(
  input: UUpdate | ValueUpdater<RResult, UUpdate>,
): input is ValueUpdater<RResult, UUpdate> => {
  return typeof input === 'function';
};

export const resolveValue = <RResult, UUpdate>(
  current: RResult,
  next: UUpdate | ValueUpdater<RResult, UUpdate>,
): UUpdate => {
  if (isValueUpdater(next)) {
    return next(current);
  }

  return next;
};
