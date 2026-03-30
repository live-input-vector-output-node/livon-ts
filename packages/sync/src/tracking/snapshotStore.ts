import type { TrackedUnit, UnitSnapshot } from './types.js';

const snapshotByUnit = new WeakMap<object, UnitSnapshot<unknown, unknown>>();

export const readTrackedUnitSnapshot = <
  RResult,
  TMeta = unknown,
>(
  unit: TrackedUnit<RResult, TMeta>,
): UnitSnapshot<RResult, TMeta | null> => {
  const current = unit.getSnapshot();
  snapshotByUnit.set(unit, current as UnitSnapshot<unknown, unknown>);
  return current;
};

export const writeTrackedUnitSnapshot = <
  RResult,
  TMeta = unknown,
>(
  unit: TrackedUnit<RResult, TMeta>,
  snapshot: UnitSnapshot<RResult, TMeta | null>,
): void => {
  snapshotByUnit.set(unit, snapshot as UnitSnapshot<unknown, unknown>);
};

export const clearTrackedUnitSnapshot = (
  unit: object,
): void => {
  snapshotByUnit.delete(unit);
};
