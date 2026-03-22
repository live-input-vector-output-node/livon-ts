import type { InputUpdater } from './types.js';

const isInputUpdater = <TInput>(
  input: TInput | InputUpdater<TInput> | undefined,
): input is InputUpdater<TInput> => {
  return typeof input === 'function';
};

export const resolveInput = <TInput>(
  current: TInput,
  next: TInput | InputUpdater<TInput> | undefined,
): TInput => {
  if (next === undefined) {
    return current;
  }

  if (isInputUpdater(next)) {
    return next(current);
  }

  return next;
};
