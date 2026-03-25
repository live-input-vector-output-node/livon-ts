import {
  readTrackedUnitSnapshot,
  subscribeTrackedUnit,
  type TrackedUnit,
  type UnitSnapshot,
} from '@livon/sync';
import { useCallback, useSyncExternalStore } from 'react';

export interface UseLivonSelectionInput<
  RResult,
  TValue,
  TMeta = unknown,
> {
  unit: TrackedUnit<RResult, TMeta>;
  select: SnapshotSelector<RResult, TValue, TMeta>;
}

interface StoreChangeListener {
  (): void;
}

interface SnapshotSelector<
  RResult,
  TValue,
  TMeta = unknown,
> {
  (snapshot: UnitSnapshot<RResult, TMeta | null>): TValue;
}

const subscribeToUnit = <RResult, TMeta>(
  unit: TrackedUnit<RResult, TMeta>,
  onStoreChange: StoreChangeListener,
) =>
  subscribeTrackedUnit({
    unit,
    onStoreChange,
  });

export const useLivonSelection = <
  RResult,
  TValue,
  TMeta = unknown,
>(
  input: UseLivonSelectionInput<RResult, TValue, TMeta>,
): TValue => {
  const { unit, select } = input;

  const subscribe = useCallback((onStoreChange: StoreChangeListener) => {
    let isSubscribed = true;
    const removeSubscription = subscribeToUnit(unit, () => {
      if (!isSubscribed) {
        return;
      }

      onStoreChange();
    });

    return () => {
      isSubscribed = false;
      removeSubscription();
    };
  }, [unit]);

  const getSnapshot = useCallback(() => {
    return select(readTrackedUnitSnapshot(unit));
  }, [select, unit]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
