import { useLivonSelection, type SubscribableSnapshotUnit } from './useLivonSelection.js';

export interface UseLivonState {
  <TSnapshot>(unit: SubscribableSnapshotUnit<TSnapshot>): TSnapshot;
}

interface SelectStateSnapshot {
  <TSnapshot>(snapshot: TSnapshot): TSnapshot;
}

const selectStateSnapshot: SelectStateSnapshot = (snapshot) => {
  return snapshot;
};

const useLivonStateInternal: UseLivonState = <TSnapshot>(
  unit: SubscribableSnapshotUnit<TSnapshot>,
): TSnapshot => {
  return useLivonSelection<TSnapshot, TSnapshot>({
    unit,
    select: selectStateSnapshot,
  });
};

export const useLivonState: UseLivonState = useLivonStateInternal;
