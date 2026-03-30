import { isUnitSnapshotEqual } from '../utils/isUnitSnapshotEqual.js';
import type { TrackedUnit, UnitSnapshot } from './types.js';

const snapshotByUnit = new WeakMap<object, UnitSnapshot<unknown, unknown>>();

const hasSameSnapshotReferences = <
  RResult,
  TMeta = unknown,
>(
  left: UnitSnapshot<RResult, TMeta | null>,
  right: UnitSnapshot<RResult, TMeta | null>,
): boolean => {
  return left.status === right.status
    && Object.is(left.value, right.value)
    && Object.is(left.meta, right.meta)
    && Object.is(left.context, right.context);
};

export const readTrackedUnitSnapshot = <
  RResult,
  TMeta = unknown,
>(
  unit: TrackedUnit<RResult, TMeta>,
): UnitSnapshot<RResult, TMeta | null> => {
  const nextSnapshot = unit.getSnapshot();
  const cached = snapshotByUnit.get(unit);
  if (cached) {
    const typedCached = cached as UnitSnapshot<RResult, TMeta | null>;
    if (
      Object.is(typedCached, nextSnapshot)
      || hasSameSnapshotReferences(typedCached, nextSnapshot)
      || isUnitSnapshotEqual({
        left: typedCached,
        right: nextSnapshot,
      })
    ) {
      return typedCached;
    }
  }

  snapshotByUnit.set(unit, nextSnapshot as UnitSnapshot<unknown, unknown>);
  return nextSnapshot;
};

export const writeTrackedUnitSnapshot = <
  RResult,
  TMeta = unknown,
>(
  unit: TrackedUnit<RResult, TMeta>,
  snapshot: UnitSnapshot<RResult, TMeta | null>,
): boolean => {
  const previous = snapshotByUnit.get(unit);
  if (previous) {
    const typedPrevious = previous as UnitSnapshot<RResult, TMeta | null>;
    if (
      Object.is(typedPrevious, snapshot)
      || hasSameSnapshotReferences(typedPrevious, snapshot)
      || isUnitSnapshotEqual({
        left: typedPrevious,
        right: snapshot,
      })
    ) {
      return false;
    }
  }

  snapshotByUnit.set(unit, snapshot as UnitSnapshot<unknown, unknown>);
  return true;
};

export const clearTrackedUnitSnapshot = (
  unit: object,
): void => {
  snapshotByUnit.delete(unit);
};
