import type { UnitSnapshot } from '../utils/types.js';

export type { UnitSnapshot, UnitStatus } from '../utils/types.js';

export interface UnitSnapshotListener<
  RResult,
  TMeta = unknown,
> {
  (snapshot: UnitSnapshot<RResult, TMeta | null>): void;
}

export interface TrackedUnit<
  RResult,
  TMeta = unknown,
> {
  getSnapshot: () => UnitSnapshot<RResult, TMeta | null>;
  subscribe: (listener: UnitSnapshotListener<RResult, TMeta>) => (() => void) | void;
}

export interface TrackedStoreChangeListener {
  (): void;
}

export interface SubscribeTrackedUnitInput<
  RResult,
  TMeta = unknown,
> {
  unit: TrackedUnit<RResult, TMeta>;
  onStoreChange: TrackedStoreChangeListener;
}
