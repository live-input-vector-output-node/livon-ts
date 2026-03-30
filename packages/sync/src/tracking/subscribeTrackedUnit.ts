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
    const didChange = writeTrackedUnitSnapshot(unit, snapshot);
    if (!didChange) {
      return;
    }

    onStoreChange();
  });

  return () => {
    removeSubscription?.();
  };
};
