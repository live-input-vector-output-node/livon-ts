import { useLivonSelection, type SubscribableSnapshotUnit } from './useLivonSelection.js';

interface SnapshotWithMeta {
  meta: unknown;
}

export interface UseLivonMeta {
  <TSnapshot extends SnapshotWithMeta>(unit: SubscribableSnapshotUnit<TSnapshot>): TSnapshot['meta'];
}

interface SelectMeta {
  <TSnapshot extends SnapshotWithMeta>(snapshot: TSnapshot): TSnapshot['meta'];
}

const selectMeta: SelectMeta = (snapshot) => {
  return snapshot.meta;
};

const useLivonMetaInternal: UseLivonMeta = <TSnapshot extends SnapshotWithMeta>(
  unit: SubscribableSnapshotUnit<TSnapshot>,
): TSnapshot['meta'] => {
  return useLivonSelection({
    unit,
    select: selectMeta,
  });
};

export const useLivonMeta: UseLivonMeta = useLivonMetaInternal;
