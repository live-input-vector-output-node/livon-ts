import { useLivonSelection, type SubscribableSnapshotUnit } from './useLivonSelection.js';

interface SnapshotWithValue {
  value: unknown;
}

export interface UseLivonValue {
  <TSnapshot extends SnapshotWithValue>(unit: SubscribableSnapshotUnit<TSnapshot>): TSnapshot['value'];
}

interface SelectValue {
  <TSnapshot extends SnapshotWithValue>(snapshot: TSnapshot): TSnapshot['value'];
}

const selectValue: SelectValue = (snapshot) => {
  return snapshot.value;
};

const useLivonValueInternal: UseLivonValue = <TSnapshot extends SnapshotWithValue>(
  unit: SubscribableSnapshotUnit<TSnapshot>,
): TSnapshot['value'] => {
  return useLivonSelection({
    unit,
    select: selectValue,
  });
};

export const useLivonValue: UseLivonValue = useLivonValueInternal;
