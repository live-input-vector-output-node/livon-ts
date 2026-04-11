import type { Configuration } from '@rspack/core';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const mergeValue = (left: unknown, right: unknown): unknown => {
  if (Array.isArray(left) && Array.isArray(right)) {
    return right;
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);

    return [...keys].reduce<Configuration>((acc, key) => {
      const leftValue = left[key];
      const rightValue = right[key];

      if (rightValue === undefined) {
        return { ...acc, [key]: leftValue };
      }

      if (leftValue === undefined) {
        return { ...acc, [key]: rightValue };
      }

      return { ...acc, [key]: mergeValue(leftValue, rightValue) };
    }, {});
  }

  return right;
};

export const mergeRspackOptions = (left: Configuration, right: Configuration): Configuration => {
  const merged = mergeValue(left, right);
  return isPlainObject(merged) ? merged : {};
};
