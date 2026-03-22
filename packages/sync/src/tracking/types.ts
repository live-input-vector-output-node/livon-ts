import type { UnitSnapshot } from '../utils/types.js';

export type { UnitSnapshot, UnitStatus } from '../utils/types.js';

export interface UnitSnapshotListener<RResult> {
  (snapshot: UnitSnapshot<RResult>): void;
}

export interface TrackedUnit<RResult> {
  destroyDelay?: number;
  get: () => RResult;
  effect: (listener: UnitSnapshotListener<RResult>) => (() => void) | void;
  stop: () => void;
}

export interface TrackedStoreChangeListener {
  (): void;
}

export interface SubscribeTrackedUnitInput<RResult> {
  unit: TrackedUnit<RResult>;
  onStoreChange: TrackedStoreChangeListener;
}
