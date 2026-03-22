export type UnitStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UnitSnapshot<RResult> {
  value: RResult;
  status: UnitStatus;
  meta: unknown;
  context: unknown;
}

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
