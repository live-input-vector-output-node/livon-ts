import { clearPendingTrackedUnitDestroy } from './destroyScheduler.js';
import { clearTrackedUnitListeners } from './listenerCounter.js';
import { clearTrackedUnitSnapshot } from './snapshotStore.js';

export const resetTrackedUnit = (
  unit: object,
): void => {
  clearPendingTrackedUnitDestroy(unit);
  clearTrackedUnitListeners(unit);
  clearTrackedUnitSnapshot(unit);
};
