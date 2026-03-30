import { useCallback, useRef, useSyncExternalStore } from 'react';

import { isShallowEqualValue } from './utils/isShallowEqualValue.js';

export interface UseLivonSelectionInput<
  TSnapshot,
  TSelection,
> {
  unit: SubscribableSnapshotUnit<TSnapshot>;
  select: SnapshotSelector<TSnapshot, TSelection>;
}

interface StoreChangeListener {
  (): void;
}

export interface SnapshotSelector<
  TSnapshot,
  TSelection,
> {
  (snapshot: TSnapshot): TSelection;
}

export interface SubscribableSnapshotUnit<TSnapshot> {
  getSnapshot: () => TSnapshot;
  subscribe: (listener: StoreChangeListener) => (() => void) | void;
}

const UNSET_SELECTION = Symbol('livon-selection-unset');

export const useLivonSelection = <
  TSnapshot,
  TSelection,
>(
  input: UseLivonSelectionInput<TSnapshot, TSelection>,
): TSelection => {
  const { unit, select } = input;
  const selectedRef = useRef<TSelection | typeof UNSET_SELECTION>(UNSET_SELECTION);
  const unitRef = useRef(unit);

  if (unitRef.current !== unit) {
    unitRef.current = unit;
    selectedRef.current = UNSET_SELECTION;
  }

  const subscribe = useCallback((onStoreChange: StoreChangeListener) => {
    const remove = unit.subscribe(onStoreChange);

    return () => {
      remove?.();
    };
  }, [unit]);

  const getSnapshot = useCallback(() => {
    const nextSelection = select(unit.getSnapshot());
    const previousSelection = selectedRef.current;

    if (
      previousSelection !== UNSET_SELECTION
      && isShallowEqualValue(previousSelection, nextSelection)
    ) {
      return previousSelection;
    }

    selectedRef.current = nextSelection;
    return nextSelection;
  }, [select, unit]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
