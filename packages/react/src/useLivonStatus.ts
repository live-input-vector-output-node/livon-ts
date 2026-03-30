import { useLivonSelection, type SubscribableSnapshotUnit } from './useLivonSelection.js';

interface SnapshotWithStatus {
  status: string;
}

export interface UseLivonStatus {
  <TSnapshot extends SnapshotWithStatus>(unit: SubscribableSnapshotUnit<TSnapshot>): TSnapshot['status'];
}

interface SelectStatus {
  <TSnapshot extends SnapshotWithStatus>(snapshot: TSnapshot): TSnapshot['status'];
}

const selectStatus: SelectStatus = (snapshot) => {
  return snapshot.status;
};

const useLivonStatusInternal: UseLivonStatus = <TSnapshot extends SnapshotWithStatus>(
  unit: SubscribableSnapshotUnit<TSnapshot>,
): TSnapshot['status'] => {
  return useLivonSelection({
    unit,
    select: selectStatus,
  });
};

export const useLivonStatus: UseLivonStatus = useLivonStatusInternal;
