import type { UnitSnapshot } from './types.js';

interface UnitSnapshotComparable<
  RResult,
  TMeta = unknown,
  TContext = unknown,
> {
  value: RResult;
  status: UnitSnapshot<RResult, TMeta, TContext>['status'];
  meta: TMeta | null;
  context: TContext;
}

export interface IsUnitSnapshotEqualInput<
  RResult,
  TMeta = unknown,
  TContext = unknown,
> {
  left: UnitSnapshotComparable<RResult, TMeta, TContext>;
  right: UnitSnapshotComparable<RResult, TMeta, TContext>;
}

const isObjectValue = (
  input: unknown,
): input is Readonly<Record<string, unknown>> => {
  return typeof input === 'object' && input !== null;
};

const isPlainObject = (
  input: unknown,
): input is Readonly<Record<string, unknown>> => {
  if (!isObjectValue(input)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
};

const isShallowEqualArray = (
  left: readonly unknown[],
  right: readonly unknown[],
): boolean => {
  return left.length === right.length
    && left.every((entry, index) => Object.is(entry, right[index]));
};

const isShallowEqualPlainObject = (
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => {
    if (!Object.prototype.hasOwnProperty.call(right, key)) {
      return false;
    }

    return Object.is(left[key], right[key]);
  });
};

const isShallowEqualValue = (
  left: unknown,
  right: unknown,
): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return isShallowEqualArray(left, right);
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    return isShallowEqualPlainObject(left, right);
  }

  return false;
};

export const isUnitSnapshotEqual = <
  RResult,
  TMeta = unknown,
  TContext = unknown,
>({
  left,
  right,
}: IsUnitSnapshotEqualInput<RResult, TMeta, TContext>): boolean => {
  return isShallowEqualValue(left.value, right.value)
    && left.status === right.status
    && isShallowEqualValue(left.meta, right.meta)
    && isShallowEqualValue(left.context, right.context);
};
