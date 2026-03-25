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
  destroyDelay?: number;
  get: () => RResult;
  effect: (listener: UnitSnapshotListener<RResult, TMeta>) => (() => void) | void;
  stop: () => void;
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
