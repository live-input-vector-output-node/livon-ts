import type {
  IsEquivalentEntityInput,
  MergeEntityInput,
} from './types.js';

const hasOwnProperty = Object.prototype.hasOwnProperty;

const isEquivalentReplace = <TInput extends object>({
  current,
  next,
}: IsEquivalentEntityInput<TInput>): boolean => {
  const nextEntries = Object.entries(next);
  if (Object.keys(current).length !== nextEntries.length) {
    return false;
  }

  return nextEntries.every(([key, nextValue]) => {
    if (!hasOwnProperty.call(current, key)) {
      return false;
    }

    return Object.is(Reflect.get(current, key), nextValue);
  });
};

const isEquivalentMerge = <TInput extends object>({
  current,
  next,
}: IsEquivalentEntityInput<TInput>): boolean => {
  return Object.entries(next).every(([key, nextValue]) => {
    if (!hasOwnProperty.call(current, key)) {
      return false;
    }

    return Object.is(Reflect.get(current, key), nextValue);
  });
};

export const mergeEntity = <TInput extends object>({
  current,
  next,
  shouldMerge,
}: MergeEntityInput<TInput>): TInput => {
  if (!current) {
    return next;
  }

  if (!shouldMerge) {
    if (isEquivalentReplace({ current, next })) {
      return current;
    }

    return next;
  }

  if (isEquivalentMerge({ current, next })) {
    return current;
  }

  return {
    ...current,
    ...next,
  };
};
