export interface InputUpdater<TInput> {
  (previous: TInput): TInput;
}

export interface ValueUpdater<RResult, UUpdate> {
  (previous: RResult): UUpdate;
}

export type UnitStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UnitSnapshot<RResult> {
  value: RResult;
  status: UnitStatus;
  meta: unknown;
  context: unknown;
}

export interface CreateUnitSnapshotInput<RResult> {
  value: RResult;
  status: UnitStatus;
  meta: unknown;
  context: unknown;
}

export interface EffectListener<RResult> {
  (snapshot: UnitSnapshot<RResult>): void;
}
