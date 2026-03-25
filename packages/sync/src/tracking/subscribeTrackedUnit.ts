import {
  addTrackedUnitListener,
  removeTrackedUnitListener,
} from './listenerCounter.js';
import {
  clearPendingTrackedUnitDestroy,
  readTrackedUnitDestroyDelay,
  scheduleTrackedUnitDestroy,
} from './destroyScheduler.js';
import { writeTrackedUnitSnapshot } from './snapshotStore.js';
import type { SubscribeTrackedUnitInput } from './types.js';

export const subscribeTrackedUnit = <
  RResult,
  TMeta = unknown,
>({
  unit,
  onStoreChange,
}: SubscribeTrackedUnitInput<RResult, TMeta>): (() => void) => {
  addTrackedUnitListener(unit);
  clearPendingTrackedUnitDestroy(unit);

  const removeEffect = unit.effect((snapshot) => {
    writeTrackedUnitSnapshot(unit, snapshot);
    onStoreChange();
  });

  return () => {
    removeEffect?.();

    const remainingListeners = removeTrackedUnitListener(unit);
    if (remainingListeners > 0) {
      return;
    }

    scheduleTrackedUnitDestroy({
      unit,
      destroyDelay: readTrackedUnitDestroyDelay(unit),
      onDestroy: () => {
        unit.stop();
      },
    });
  };
};
