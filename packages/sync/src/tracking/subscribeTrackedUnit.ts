import { writeTrackedUnitSnapshot } from './snapshotStore.js';
import type { SubscribeTrackedUnitInput } from './types.js';

export const subscribeTrackedUnit = <
  RResult,
  TMeta = unknown,
>({
  unit,
  onStoreChange,
}: SubscribeTrackedUnitInput<RResult, TMeta>): (() => void) => {
  const removeSubscription = unit.subscribe((snapshot) => {
    writeTrackedUnitSnapshot(unit, snapshot);
    onStoreChange();
  });

  return () => {
    removeSubscription?.();
  };
};
