import type { TrackedUnit, UnitSnapshot } from './types.js';

const snapshotByUnit = new WeakMap<object, UnitSnapshot<unknown>>();

export const readTrackedUnitSnapshot = <RResult>(
  unit: TrackedUnit<RResult>,
): UnitSnapshot<RResult> => {
  const existing = snapshotByUnit.get(unit);
  if (existing) {
    return existing as UnitSnapshot<RResult>;
  }

  const created: UnitSnapshot<RResult> = {
    value: unit.get(),
    status: 'idle',
    meta: null,
    context: null,
  };

  snapshotByUnit.set(unit, created as UnitSnapshot<unknown>);

  return created;
};

export const writeTrackedUnitSnapshot = <RResult>(
  unit: TrackedUnit<RResult>,
  snapshot: UnitSnapshot<RResult>,
): void => {
  snapshotByUnit.set(unit, snapshot as UnitSnapshot<unknown>);
};

export const clearTrackedUnitSnapshot = (
  unit: object,
): void => {
  snapshotByUnit.delete(unit);
};
