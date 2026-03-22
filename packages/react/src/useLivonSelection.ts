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
> {
  unit: TrackedUnit<RResult>;
  select: SnapshotSelector<RResult, TValue>;
}

interface StoreChangeListener {
  (): void;
}

interface SnapshotSelector<
  RResult,
  TValue,
> {
  (snapshot: UnitSnapshot<RResult>): TValue;
}

const subscribeToUnit = <RResult>(unit: TrackedUnit<RResult>, onStoreChange: StoreChangeListener) =>
  subscribeTrackedUnit({
    unit,
    onStoreChange,
  });

export const useLivonSelection = <
  RResult,
  TValue,
>(
  input: UseLivonSelectionInput<RResult, TValue>,
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
