import type { TrackedUnit, UnitSnapshot } from './types.js';

const snapshotByUnit = new WeakMap<object, UnitSnapshot<unknown, unknown>>();

export const readTrackedUnitSnapshot = <
  RResult,
  TMeta = unknown,
>(
  unit: TrackedUnit<RResult, TMeta>,
): UnitSnapshot<RResult, TMeta | null> => {
  const existing = snapshotByUnit.get(unit);
  if (existing) {
    return existing as UnitSnapshot<RResult, TMeta | null>;
  }

  const created: UnitSnapshot<RResult, TMeta | null> = {
    value: unit.get(),
    status: 'idle',
    meta: null,
    context: null,
  };

  snapshotByUnit.set(unit, created as UnitSnapshot<unknown, unknown>);

  return created;
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
