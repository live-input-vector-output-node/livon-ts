import { clearTrackedUnitSnapshot } from './snapshotStore.js';

export const resetTrackedUnit = (
  unit: object,
): void => {
  clearTrackedUnitSnapshot(unit);
};
